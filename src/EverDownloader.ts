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

import { tauri } from "@tauri-apps/api";
import { plainToClass } from "class-transformer";

declare namespace EverDownloader {

    interface Progress {
        getTotalSize() : number;
        getDownloadedSize() : number;
        isSuccessful() : boolean;
        isFinished() : boolean;
        isValidated() : boolean;
        isError() : boolean;
        getError() : string | null;
    }

    interface DownloadTask extends Promise<EverDownloader.Progress> {
        dispose() : Promise<void>;
        isDisposed() : boolean;
        unzipResult(dir: string) : Promise<void>;
        getResult() : Promise<Uint8Array>;
    }
}

class Progress implements EverDownloader.Progress {
    private total: number;
    private downloaded: number;
    private finished: boolean;
    private validated: boolean;
    private error: string | null;

    public getTotalSize() : number {
        return this.total;
    }

    public getDownloadedSize() : number {
        return this.downloaded;
    }
    
    public isSuccessful() : boolean {
        return this.isValidated() && this.isFinished() && !this.isError();
    }

    public isValidated() : boolean {
        return this.validated;
    }

    public isFinished() : boolean {
        return this.finished;
    }

    public isError() : boolean {
        return this.error !== null;
    }

    public getError() : string | null {
        return this.error;
    }

    public constructor(total: number, downloaded: number, finished: boolean, validated: boolean, error: string | null) {
        this.total = total;
        this.downloaded = downloaded;
        this.finished = finished;
        this.validated = validated;
        this.error = error;
    }
}

class DownloadInfo {
    public downloaded!: number;
    public finished!: boolean;
    public total_size!: number;
    public err!: string | null;
    constructor(downloaded?: number, finished?: boolean, total_size?: number, err?: string | null) {
        if (typeof downloaded === "number") {
            this.downloaded = downloaded;
        }
        if (typeof finished === "boolean") {
            this.finished = finished;
        }
        if (typeof total_size === "number") {
            this.total_size = total_size;
        }
        if (err !== undefined) {
            this.err = err;
        }
    }
}

class DownloadTask extends Promise<EverDownloader.Progress> implements EverDownloader.DownloadTask {
    private hash: string;
    private size!: number;
    private active!: boolean;

    constructor(url: string, hash: string, validate: boolean, update: (progress: EverDownloader.Progress) => void) {

        super((resolve => {
            tauri.invoke("el_download", {url: url, hash: hash})
            .then(ret => {
                if (ret !== null) {
                    if (typeof ret !== "string") {
                        ret = `Internal Error: ${ret}`;
                    }
                    throw new Progress(0, 0, false, false, ret as string);
                }
                return this.runner(update);
            })
            .then(ret => {
                if (ret.err !== null) {
                    throw new Progress(ret.total_size, ret.downloaded, ret.finished, false, ret.err);
                }
                if (!ret.finished || ret.downloaded != ret.total_size) {
                    throw new Progress(ret.total_size, ret.downloaded, ret.finished, false, "Download interrupted");
                }
                this.size = ret.downloaded;
                if (!validate) {
                    throw new Progress(this.size, this.size, true, true, null);
                }
                return this.validate();
            })
            .then(ret => {
                if (!ret) {
                    throw new Progress(this.size, this.size, true, false, "Validation failed");
                }
                throw new Progress(this.size, this.size, true, true, null);
            })
            .catch(ret => {
                if (ret instanceof Progress) {
                    resolve(ret);
                } else {
                    throw ret;
                }
            })
        }));
        this.active = true;
        this.hash = hash;
    }

    public runner(update: (progress:EverDownloader.Progress) => void) : Promise<DownloadInfo> {
        return new Promise(resolve => {
            this.tick(resolve, update);
        })
    }

    private tick(resolve: (result: DownloadInfo) => void, update: (progress:EverDownloader.Progress) => void) {
        tauri.invoke("el_download_progress", {hash: this.hash})
        .then(ret => {
            if (typeof ret === "string") {
                console.log(ret);
                const progress = new Progress(0, 0, false, false, ret);
                update(progress);
                const info = new DownloadInfo(0, false, 0 , ret);
                resolve(info);
                return;
            }
            const info = plainToClass(DownloadInfo, ret);
            const progress = new Progress(info.total_size, info.downloaded, info.finished, false, null);
            update(progress);
            if (info.err !== null) {
                resolve(info);
                return;
            }
            if (!info.finished) {
                setTimeout(() => this.tick(resolve, update), EverDownloader.updateInterval);
            } else {
                resolve(info);
            }
        })
    }

    private validate() : Promise<boolean> {
        return new Promise(resolve => {
            tauri.invoke("el_download_validate_sha256", {hash: this.hash})
            .then(ret => {
                if (typeof ret === "boolean") {
                    resolve(ret);
                    return;
                }
                if (typeof ret === "string") {
                    throw ret;
                }
                throw "Internal Error";
            })
        })
    }

    public unzipResult(dir: string) : Promise<void> {
        return new Promise(resolve => {
            tauri.invoke("el_download_unzip", {hash: this.hash, path: dir})
            .then(ret => {
                if (ret === null) {
                    resolve();
                    return;
                }
                if (typeof ret === "string") {
                    throw ret;
                }
                throw "Internal Error";
            })
        })
    }

    public getResult() : Promise<Uint8Array> {
        return new Promise(resolve => {
            tauri.invoke("el_download_getfile", {hash: this.hash})
            .then(ret => {
                if (ret instanceof Array && typeof ret[0] === "number") {
                    resolve(new Uint8Array(ret));
                    return;
                }
                if (typeof ret === "string") {
                    throw ret;
                }
                throw "Internal Error";
            })
        })
    }

    public dispose() : Promise<void> {
        this.active = false;
        return new Promise(resolve => {
            tauri.invoke("el_download_terminate", {hash: this.hash})
            .then(ret => {
                if (ret === null) {
                    resolve();
                    return;
                }
                if (typeof ret === "string") {
                    throw ret;
                }
                throw "Internal Error";
            })
        })
    }

    public isDisposed() : boolean {
        return !this.active;
    }
}

class EverDownloader {

    public static updateInterval = 100;

    public static download(url: string, hash?: string, timeout?: number, update?: (progress: EverDownloader.Progress) => void) : Promise<Uint8Array> {
        if (typeof timeout === "number") {
            return this.download_timeout(url, timeout, hash, update);
        } else {
            return this.download_simple(url, hash, update);
        }
    }

    public static download_simple(url: string, hash?: string, update?: (progress: EverDownloader.Progress) => void) : Promise<Uint8Array> {
        return new Promise(resolve => {
            const ahash = typeof hash === "string" ? hash : url;
            const aupdate = typeof update === "function" ? update : () => {};
            const task = new DownloadTask(url, ahash, typeof hash === "string", aupdate);
            task.then(ret => {
                if (!ret.isSuccessful()) {
                    task.dispose();
                    throw ret.getError();
                }
                return task.getResult();
            })
            .then(data => {
                task.dispose();
                resolve(data);
            })
        })
    }

    public static download_timeout(url: string, timeout: number, hash?: string, update?: (progress: EverDownloader.Progress) => void) : Promise<Uint8Array> {
        return new Promise(resolve => {
            const ahash = typeof hash === "string" ? hash : url;
            const aupdate = typeof update === "function" ? update : () => {};
            const task = new DownloadTask(url, ahash, typeof hash === "string", aupdate);
            const time = this.delay(timeout);
            Promise.race([time, task]).then(ret => {
                if (ret instanceof Object) {
                    if (!ret.isSuccessful()) {
                        task.dispose();
                        throw ret.getError();
                    }
                    return task.getResult();
                } else {
                    task.dispose();
                    throw "timeout";
                }
            })
            .then(data => {
                task.dispose();
                resolve(data);
            })
        })
    }

    private static delay(ms: number) : Promise<void> {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        })
    }

}

export default EverDownloader;
