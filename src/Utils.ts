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
import { EverConfig } from "./EverConfig";
import { EverLauncher } from "./EverLauncher";

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
export async function getPlatform() : Promise<string|undefined> {
    const arch = await os.arch();
    const type = await os.type();
    switch (type) {
        case "Linux":
            if (arch === "x86_64") {
                return "linux";
            }
            break;
        case "Darwin":
            if (arch === "x86_64") {
                return "mac";
            }
            break;
        case "Windows_NT":
            if (arch === "x86_64") {
                return "windows"
            } else if (arch === "x86") {
                return "win32"
            }
            break;
    }
    return undefined;
}

export async function getDataDir(sub?: string) : Promise<string> {
    const dataDir = await path.dataDir();
    if (sub === undefined) {
        return path.join(dataDir, "EverLauncher");
    } else {
        return path.join(dataDir, "EverLauncher", sub);
    }
}

export async function getConfig() : Promise<EverConfig|undefined> {
    try {
        const configPath = await getDataDir(EverLauncher.localConfig);
        const config = await fs.readTextFile(configPath);
        return EverConfig.fromJSON(config);
    } catch (err) {
        log(err);
        return (undefined);
    }
}

export async function saveConfig(config: EverConfig) : Promise<void> {
    const configPath = await getDataDir(EverLauncher.localConfig);
    return fs.writeFile({ contents: JSON.stringify(config), path: configPath });
}

/*eslint @typescript-eslint/no-explicit-any: "off"*/
/*eslint @typescript-eslint/explicit-module-boundary-types: "off"*/
export function log(message?: any, ...optionalParams: any[]) : void {
    console.log(message, optionalParams);
}