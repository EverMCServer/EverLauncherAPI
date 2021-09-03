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

declare namespace EverConfig {

    class GameConfig {
        public displayName: string;
        public version: string;
        public json: string;
        public jreVersion: string;

        @Type(() => DownloadSource)
        public mods: Map<string, DownloadSource>;

        @Type(() => DownloadSource)
        public resourcepacks: Map<string, DownloadSource>;

        @Type(() => DownloadSource)
        public extra: Map<string, DownloadSource>;
    }

    class JREVersion {
        public windows: DownloadSource;
        public win32: DownloadSource;
        public linux: DownloadSource;
        public mac: DownloadSource;
    }

    class DownloadSource {
        public link: string[];
        public sha256: string;
        public priority: Map<string, number[]>;
    }

    class ProxyConfig {
        public priority: Map<string, string[]>;
        public proxyList: Map<string, Map<string, string>>;
    }

    class RegionCheckConfig {
        public url: string;
        public regex: string;
    }
}


class EverConfig {

    @Type(() => EverConfig.JREVersion)
    public jre!: Map<string, EverConfig.JREVersion>;

    public defaultMcVersion!: string;

    @Type(() => EverConfig.GameConfig)
    public mcVersion!: Map<string, EverConfig.GameConfig>;

    @Type(() => EverConfig.ProxyConfig)
    public proxy!: Map<string, EverConfig.ProxyConfig>;

    @Type(() => EverConfig.RegionCheckConfig)
    public regionCheck!: EverConfig.RegionCheckConfig[];

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

export default EverConfig;
