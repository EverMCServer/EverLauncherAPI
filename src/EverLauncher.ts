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
import { EverConfig, RegionCheckConfig, GameConfig } from './EverConfig';
import { EverDownloader } from './EverDownloader';
import * as Utils from './Utils'

export class EverLauncher {

    private static readonly defaultDeploySource: string | null = defaultDeploy.deploySource;
    public static readonly localConfig = "local.json";
    public static defaultTimeout = 5000;

    private static currentConfig: EverConfig;
    private static currentRegion: string;
    private static currentPlatform: string;
    
    public static async fetchRemote() : Promise<void> {
        let config = await Utils.getConfig();
        const remote = config?.deploySource || this.defaultDeploySource;
        if (remote === null) {
            throw "No deploy source set.";
        }
        const data = await EverDownloader.download_timeout(remote, this.defaultTimeout)
        const json = new TextDecoder().decode(data);
        const newconfig = EverConfig.fromJSON(json);
        if (config === undefined) {
            config = newconfig;
        } else {
            config.merge(newconfig);
        }
        EverLauncher.currentConfig = config;
        return await Utils.saveConfig(config);
    }

    public static async getRegion() : Promise<string> {
        if (!(EverLauncher.currentConfig instanceof EverConfig)) {
            throw "Not initialized."
        }
        if (EverLauncher.currentConfig.regionCheck.length <= 0) {
            throw "No regionCheck methods defined."
        }
        const ret = await Promise.any(EverLauncher.currentConfig.regionCheck.map(this.checkRegion));
        if (typeof ret === "string") {
            return ret;
        } else {
            return "default";
        }
    }

    public static async getPlatform() : Promise<string> {
        const ret = await Utils.getPlatform();
        if (typeof ret === "string") {
            this.currentPlatform = ret;
            return ret;
        } else {
            throw "Unsupported platform";
        }
    }

    public static async checkRegion(method: RegionCheckConfig) : Promise<string> {
        const data = await EverDownloader.download_timeout(method.url, this.defaultTimeout);
        const text = new TextDecoder().decode(data);
        const regex = new RegExp(method.regex);
        const match = text.match(regex);
        if (match !== null) {
            this.currentRegion = match[1];
            return match[1];
        } else {
            throw `Failed to get region from ${method.url}, result = ${text}`;
        }
    }

    public static hasUpdate() : boolean {
        // TODO
        return false;
    }

    public static region() : string {
        if (typeof EverLauncher.currentRegion !== "string") {
            throw "Not initialized."
        }
        return this.currentRegion;
    }

    public static platform() : string {
        if (typeof EverLauncher.currentConfig !== "string") {
            throw "Not initialized."
        }
        return this.currentPlatform;
    }

    public static config() : EverConfig {
        if (!(EverLauncher.currentConfig instanceof EverConfig)) {
            throw "Not initialized."
        }
        return this.currentConfig;
    }

    public static async getGameConfig(version: string) : Promise<GameConfig> {
        if (!(EverLauncher.currentConfig instanceof EverConfig)) {
            throw "Not initialized."
        }
        const config = EverLauncher.currentConfig.mcVersion.get(version);
        if (config instanceof GameConfig) {
            return config;
        } else {
            throw "Version not found."
        }
    }
}
