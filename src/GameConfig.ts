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

import { Child, Command } from "@tauri-apps/api/shell";
import { Exclude, Type } from "class-transformer";
import { EverLauncher } from ".";
import { DownloadSource } from "./EverConfig";
import * as Utils from './Utils'

export class GameConfig {
    public displayName!: string;
    public version!: string;
    public json!: string;
    public jreVersion!: string;
    public customJreLocation!: string;

    @Type(() => DownloadSource)
    public mods!: Map<string, DownloadSource>;

    @Type(() => DownloadSource)
    public resourcepacks!: Map<string, DownloadSource>;

    @Type(() => DownloadSource)
    public extra!: Map<string, DownloadSource>;

    @Exclude()
    private jreDownloadSource!: DownloadSource;

    public async getJRE() : Promise<string|undefined> {
        if (typeof this.jreVersion !== "string" || this.jreVersion.length == 0) {
            throw "JRE version not set."
        }
        if (typeof this.customJreLocation === "string" &&
            this.customJreLocation.length > 0 &&
            await GameConfig.getJRE(this.customJreLocation)
        ) {
            return this.customJreLocation;
        }
        const jreDir = await this.getJREDefaultPath();
        const path = jreDir + "/" + this.jreVersion + "/bin/java";
        if (await GameConfig.getJRE(path)) {
            return path;
        }
        return undefined;
    }

    public static getJRE(path: string) : Promise<boolean> {
        return new Promise(resolve => {
            const command = new Command(path, "--version");
            let taskid : Child | undefined;
            command.on('close', data => {
                taskid = undefined;
                if (data.code === 0) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            })
            command.on('error', () => {
                taskid = undefined;
                resolve(false);
            });
            command.spawn()
                .then(e => taskid = e)
                .catch(() => resolve(false));
            setTimeout(() => {
                if (taskid !== undefined) {
                    taskid.kill();
                    resolve(false);
                }
            }, 1000);
        })
    }

    private getJREDownloadSource() : DownloadSource {
        const version = EverLauncher.config().jre.get(this.jreVersion);
        if (version === undefined) {
            throw `JRE Version ${this.jreVersion} not available in ${EverLauncher.config().jre.keys}`
        }
        const url = version.get(EverLauncher.platform());
        this.jreDownloadSource = url;
        return url;
    }

    public getJREDownloadURL() : string[] {
        const url = this.jreDownloadSource || this.getJREDownloadSource();
        const region = EverLauncher.region();
        const priority = url.priority.get(region);
        if (priority !== undefined) {
            const ret: string[] = [];
            for (const index of priority) {
                ret.push(url.link[index]);
            }
            return ret;
        }
        return url.link;
    }

    public getJREDownloadHash() : string {
        const url = this.jreDownloadSource || this.getJREDownloadSource();
        return url.sha256;
    }

    public getJREDefaultPath() : Promise<string> {
        return Utils.getDataDir("jre");
    }

}
