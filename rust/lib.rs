/**
 * EverLauncherAPI - API service for EverLauncher
 * Copyright (C) 2021 djytw
 * 
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 * 
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

use std::collections::hash_map::HashMap;
use std::io::Cursor;
use std::io::Write;
use std::path::Path;
use std::sync::Arc;
use std::sync::Mutex;
use std::sync::RwLock;
use std::sync::atomic::AtomicBool;
use std::sync::atomic::AtomicU64;
use std::sync::atomic::AtomicUsize;
use std::sync::atomic::Ordering;

use futures_util::StreamExt;
use hex;
use once_cell::sync::Lazy;
use serde::Serialize;
use sha2::Digest;
use sha2::Sha256;
use tokio::task::JoinHandle;

#[derive(Serialize, Debug)]
pub struct DownloadInfo {
    downloaded: usize,
    finished: bool,
    total_size: u64,
    err: Option<String>,
}

struct DownloadHandleRef {
    downloaded: AtomicUsize,
    finished: AtomicBool,
    total_size: AtomicU64,
    data: Mutex<Cursor<Vec<u8>>>,
    url: String,
    hash: String,
    err: RwLock<Option<String>>,
}

struct DownloadHandle {
    inner: Arc<DownloadHandleRef>,
    handle: Mutex<Option<JoinHandle<()>>>,
}

impl DownloadHandle {

    pub fn download_progress(&self) -> DownloadInfo {
        return DownloadInfo{
            downloaded: self.inner.downloaded.load(Ordering::Relaxed),
            finished: self.inner.finished.load(Ordering::Relaxed),
            total_size: self.inner.total_size.load(Ordering::Relaxed),
            err: self.inner.err.read().unwrap().clone(),
        };
    }

    pub fn download_start(&self) {
        let dref = Arc::clone(&self.inner);
        let handle = tokio::spawn(async move {
            match dref.download_internal().await {
                Ok(()) => {
                    dref.finished.store(true, Ordering::Relaxed);
                    return;
                },
                Err(e) => {
                    dref.err.write().unwrap().replace(e.to_string());
                    return;
                }
            };
        });
        self.handle.lock().unwrap().replace(handle);
    }

    pub fn download_terminate(&self) {
        let mut handle = self.handle.lock().unwrap();
        if handle.is_none() {
            return;
        }
        handle.take().unwrap().abort();
        self.inner.err.write().unwrap().replace("Terminated".into());
    }

    pub fn validate_sha256(&self) -> Result<bool, Box<dyn std::error::Error>> {
        return self.inner.validate_sha256();
    }

    pub fn unzip(&self, path: String) -> Result<(), Box<dyn std::error::Error>> {
        return self.inner.unzip(path);
    }

    pub fn getfile(&self) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        return self.inner.getfile();
    }
}

impl DownloadHandleRef {

    async fn download_internal(&self) -> Result<(), Box<dyn std::error::Error>> {

        let resp = reqwest::get(self.url.clone()).await?;
        self.total_size.store(resp.content_length().unwrap_or(0), Ordering::Relaxed);
        let mut stream = resp.bytes_stream();

        while let Some(item) = stream.next().await {
            let bytes = item?;
            let mut data = self.data.lock().unwrap();
            match data.write_all(&bytes) {
                Ok(_) => (),
                Err(e) => return Err(e.into()),
            };
            drop(data);
            self.downloaded.fetch_add(bytes.len(), Ordering::Relaxed);
        }
        return Ok(());
    }

    fn validate_sha256(&self) -> Result<bool, Box<dyn std::error::Error>> {
        if !self.finished.load(Ordering::Relaxed) {
            return Err("Not finished".into());
        }
        let mut hasher = Sha256::new();
        let datalock = self.data.lock().unwrap();
        let data = datalock.clone().into_inner();
        drop(datalock);
        hasher.update(data);
        let result = hasher.finalize();
        let hexhash = hex::decode(self.hash.clone())?;
        return Ok(hexhash.eq(result.as_slice()));
    }

    fn unzip(&self, path: String) -> Result<(), Box<dyn std::error::Error>> {
        let datalock = self.data.lock().unwrap();
        let data = Cursor::new(datalock.clone().into_inner());
        drop(datalock);
        let mut archive = zip::ZipArchive::new(data)?;
        let pathp = Path::new(&path);
        archive.extract(pathp)?;
        return Ok(());
    }

    fn getfile(&self) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        let datalock = self.data.lock().unwrap();
        let data = datalock.clone().into_inner();
        drop(datalock);
        return Ok(data);
    }
}

fn download_init(url: String, hash: String) -> DownloadHandle {
    return DownloadHandle {
        handle: Mutex::new(None),
        inner: Arc::new(DownloadHandleRef {
            downloaded: AtomicUsize::new(0),
            finished: AtomicBool::new(false),
            total_size: AtomicU64::new(0),
            data: Mutex::new(Cursor::new(Vec::new())),
            url: url,
            hash: hash,
            err: RwLock::new(None),
        })
    }
}

static DOWNLOADING : Lazy<Mutex<HashMap<String, DownloadHandle>>> = Lazy::new(|| Mutex::new(
    HashMap::new()
));

pub async fn el_download(url: String, hash: String) -> Result<(), String> {
   let mut downloading = DOWNLOADING.lock().unwrap();
   if downloading.contains_key(&hash.clone()) {
       return Err("downloading exists".into());
   }
   let dhandle = download_init(url, hash.clone());
   dhandle.download_start();
   downloading.insert(hash.clone(), dhandle);
   drop(downloading);
   return Ok(());
}

pub async fn el_download_progress(hash: String) -> Result<DownloadInfo, String> {
    let downloading = DOWNLOADING.lock().unwrap();
    let dhandle = downloading.get(&hash);
    if dhandle.is_none() {
        return Err("Not exists".into());
    }
    let handle = dhandle.unwrap();
    return Ok(handle.download_progress());
}

pub async fn el_download_terminate(hash: String) -> Result<(), String> {
    let mut downloading = DOWNLOADING.lock().unwrap();
    let dhandle = downloading.remove(&hash);
    if dhandle.is_none() {
        return Err("Not exists".into());
    }
    dhandle.unwrap().download_terminate();
    return Ok(());
}

pub async fn el_download_validate_sha256(hash: String) -> Result<bool, String> {
    let downloading = DOWNLOADING.lock().unwrap();
    let dhandle = downloading.get(&hash);
    if dhandle.is_none() {
        return Err("Not exists".into());
    }
    let handle = dhandle.unwrap();
    return handle.validate_sha256().map_err(|e| e.to_string());
}

pub async fn el_download_unzip(hash: String, path: String) -> Result<(), String> {
    let downloading = DOWNLOADING.lock().unwrap();
    let dhandle = downloading.get(&hash);
    if dhandle.is_none() {
        return Err("Not exists".into());
    }
    let handle = dhandle.unwrap();
    return handle.unzip(path).map_err(|e| e.to_string());
}

pub async fn el_download_getfile(hash: String) -> Result<Vec<u8>, String> {
    let downloading = DOWNLOADING.lock().unwrap();
    let dhandle = downloading.get(&hash);
    if dhandle.is_none() {
        return Err("Not exists".into());
    }
    let handle = dhandle.unwrap();
    return handle.getfile().map_err(|e| e.to_string());
}
