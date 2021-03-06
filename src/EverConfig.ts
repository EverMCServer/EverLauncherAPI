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

import { Type, plainToClass } from "class-transformer";
import { GameConfig } from "./GameConfig";

export class JREVersion {
    public windows!: DownloadSource;
    public win32!: DownloadSource;
    public linux!: DownloadSource;
    public mac!: DownloadSource;
    /*eslint @typescript-eslint/no-explicit-any: ["off"]*/
    public get(platform: string) : DownloadSource {
        return (this as any)[platform] as DownloadSource;
    }
}

export class DownloadSource {
    public link!: string[];
    public sha256!: string;
    public priority!: Map<string, number[]>;
}

export class ProxyConfig {
    public priority!: Map<string, string[]>;
    public proxyList!: Map<string, Map<string, string>>;
}

export class RegionCheckConfig {
    public url!: string;
    public regex!: string;
}

export { GameConfig } from "./GameConfig";

export class EverConfig {

    @Type(() => JREVersion)
    public jre!: Map<string, JREVersion>;

    public defaultMcVersion!: string;

    @Type(() => GameConfig)
    public mcVersion!: Map<string, GameConfig>;

    @Type(() => ProxyConfig)
    public proxy!: Map<string, ProxyConfig>;

    @Type(() => RegionCheckConfig)
    public regionCheck!: RegionCheckConfig[];

    public deploySource!: string;
    
    public static fromJSON(json: string) : EverConfig {
        const obj = JSON.parse(json);
        return plainToClass(EverConfig, obj);
    }

    /**
     * Merge another config into current one. Duplicated value will be overwritten.
     * @param another another config
     */
    public merge(another: EverConfig) : void {
        // TODO 
    }

}
