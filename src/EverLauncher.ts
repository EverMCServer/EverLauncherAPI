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

import * as defaultDeploy from './default_deploy.json'
import EverConfig from './EverConfig';
import EverDownloader from './EverDownloader';
import Utils from './Utils';

export class EverLauncher {

    private static readonly defaultDeploySource: string | null = defaultDeploy.deploySource;
    public static readonly localConfig = "local.json";
    public static defaultTimeout = 5000;
    private static currentConfig: EverConfig;
    
    public static fetchRemote() : Promise<void> {
        return new Promise(resolve => {
            Utils.getConfig()
            .then(config => {
                const remote = config?.deploySource || this.defaultDeploySource;
                if (remote === null) {
                    throw "No deploy source set.";
                }
                return Promise.all([
                    config, 
                    EverDownloader.download_timeout(remote, this.defaultTimeout)
                ]);
            })
            .then(([config, data]) => {
                const json = new TextDecoder().decode(data);
                const newconfig = EverConfig.fromJSON(json);
                if (config === undefined) {
                    config = newconfig;
                } else {
                    config.merge(newconfig);
                }
                EverLauncher.currentConfig = config;
                return Utils.saveConfig(config);
            })
            .then(() => {
                resolve();
            })
        })
    }

    public static getRegion() : Promise<string> {
        return new Promise(resolve => {
            if (!(EverLauncher.currentConfig instanceof EverConfig)) {
                throw "Not initialized."
            }
            if (EverLauncher.currentConfig.regionCheck.length <= 0) {
                throw "No regionCheck methods defined."
            }
            Promise.any(EverLauncher.currentConfig.regionCheck.map(this.checkRegion))
            .then(ret => {
                if (typeof ret === "string") {
                    resolve(ret);
                } else {
                    resolve("default");
                }
            })
        })
    }

    public static checkRegion(method: EverConfig.RegionCheckConfig) : Promise<string> {
        return new Promise(resolve => {
            EverDownloader.download_timeout(method.url, this.defaultTimeout)
            .then(data => {
                const text = new TextDecoder().decode(data);
                const regex = new RegExp(method.regex);
                const match = text.match(regex);
                if (match !== null) {
                    resolve(match[1]);
                } else {
                    throw `Failed to get region from ${method.url}, result = ${text}`;
                }
            })
        })
    }

    public static hasUpdate() : boolean {
        // TODO
        return false;
    }
}
