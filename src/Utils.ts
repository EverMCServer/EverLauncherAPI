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

import { fs, os, path } from "@tauri-apps/api";
import EverConfig from "./EverConfig";
import { EverLauncher } from "./EverLauncher";

export default class Utils {

    /**
     * Get the current platform. In unsupported platforms, `undefined` will be returned.
     * 
     *     linux+x64 -> 'linux'
     *     darwin+x64 -> 'mac'
     *     windows+x64 -> 'windows'
     *     windows+x86 -> 'win32'
     *     others -> undefined
     * 
     * @returns current platform.
     */
    public static getPlatform() : Promise<string|undefined> {
        return new Promise(resolve => {
            Promise.all([os.arch(), os.type()])
            .then(([arch, type]) => {
                switch (type) {
                    case "Linux":
                        if (arch === "x86_64") {
                            resolve("linux");
                            return;
                        }
                        break;
                    case "Darwin":
                        if (arch === "x86_64") {
                            resolve("mac");
                            return;
                        }
                        break;
                    case "Windows_NT":
                        if (arch === "x86_64") {
                            resolve("windows");
                            return;
                        } else if (arch === "x86") {
                            resolve("win32");
                            return;
                        }
                        break;
                }
                resolve(undefined);
            })
        })
    }

    public static getDataDir(sub?: string) : Promise<string> {
        return new Promise(resolve => {
            path.dataDir()
            .then(dataDir => {
                if (sub === undefined) {
                    return path.join(dataDir, "EverLauncher");
                } else {
                    return path.join(dataDir, "EverLauncher", sub);
                }
            })
            .then(dir => {
                resolve(dir);
            })
        });
    }

    public static getConfig() : Promise<EverConfig|undefined> {
        return new Promise(resolve => {
            Utils.getDataDir(EverLauncher.localConfig)
            .then(configPath => {
                return fs.readTextFile(configPath);
            })
            .then(config => {
                resolve(EverConfig.fromJSON(config));
            })
            .catch(err => {
                Utils.log(err);
                resolve(undefined);
            })
        });
    }

    public static saveConfig(config: EverConfig) : Promise<void> {
        return new Promise(resolve => {
            Utils.getDataDir(EverLauncher.localConfig)
            .then(configPath => {
                return fs.writeFile({contents: JSON.stringify(config), path: configPath});
            })
            .then(() => {
                resolve();
            })
        });
    }

    /*eslint @typescript-eslint/no-explicit-any: "off"*/
    /*eslint @typescript-eslint/explicit-module-boundary-types: "off"*/
    public static log(message?: any, ...optionalParams: any[]) : void {
        console.log(message, optionalParams);
    }
}
