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

export class Progress {
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

export class DownloadInfo {
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

export class DownloadTask extends Promise<Progress> {
    private hash: string;
    private size!: number;
    private active!: boolean;

    constructor(url: string, hash: string, validate: boolean, update: (progress: Progress) => void) {

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

    private runner(update: (progress:Progress) => void) : Promise<DownloadInfo> {
        return new Promise(resolve => {
            this.tick(resolve, update);
        })
    }

    private tick(resolve: (result: DownloadInfo) => void, update: (progress:Progress) => void) {
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

    private async validate() : Promise<boolean> {
        const ret = await tauri.invoke("el_download_validate_sha256", { hash: this.hash });
        if (typeof ret === "boolean") {
            return ret;
        }
        if (typeof ret === "string") {
            throw ret;
        }
        throw "Internal Error";
    }

    public async unzipResult(dir: string) : Promise<void> {
        const ret = await tauri.invoke("el_download_unzip", { hash: this.hash, path: dir });
        if (ret === null) {
            return;
        }
        if (typeof ret === "string") {
            throw ret;
        }
        throw "Internal Error";
    }

    public async getResult() : Promise<Uint8Array> {
        const ret = await tauri.invoke("el_download_getfile", { hash: this.hash });
        if (ret instanceof Array && typeof ret[0] === "number") {
            return new Uint8Array(ret);
        }
        if (typeof ret === "string") {
            throw ret;
        }
        throw "Internal Error";
    }

    public async dispose() : Promise<void> {
        this.active = false;
        const ret = await tauri.invoke("el_download_terminate", { hash: this.hash });
        if (ret === null) {
            return;
        }
        if (typeof ret === "string") {
            throw ret;
        }
        throw "Internal Error";
    }

    public isDisposed() : boolean {
        return !this.active;
    }
}

export class EverDownloader {

    public static updateInterval = 100;

    public static download(url: string, hash?: string, timeout?: number, update?: (progress: Progress) => void) : Promise<Uint8Array> {
        if (typeof timeout === "number") {
            return this.download_timeout(url, timeout, hash, update);
        } else {
            return this.download_simple(url, hash, update);
        }
    }

    public static async download_simple(url: string, hash?: string, update?: (progress: Progress) => void) : Promise<Uint8Array> {
        const ahash = typeof hash === "string" ? hash : url;
        const aupdate = typeof update === "function" ? update : () => {};
        const task = new DownloadTask(url, ahash, typeof hash === "string", aupdate);
        const ret = await task;
        if (!ret.isSuccessful()) {
            task.dispose();
            throw ret.getError();
        }
        const data = await task.getResult();
        task.dispose();
        return (data);
    }

    public static async download_timeout(url: string, timeout: number, hash?: string, update?: (progress: Progress) => void) : Promise<Uint8Array> {
        const ahash = typeof hash === "string" ? hash : url;
        const aupdate = typeof update === "function" ? update : () => {};
        const task = new DownloadTask(url, ahash, typeof hash === "string", aupdate);
        const time = this.delay(timeout);
        const ret = await Promise.race([time, task]);
        if (ret instanceof Object) {
            if (!ret.isSuccessful()) {
                task.dispose();
                throw ret.getError();
            }
            const data = await task.getResult();
            task.dispose();
            return data;
        } else {
            task.dispose();
            throw "timeout";
        }
    }

    private static delay(ms: number) : Promise<void> {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        })
    }

}
