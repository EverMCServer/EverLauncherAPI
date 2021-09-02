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
import Utils from './Utils';

export class EverLauncher {

    private static readonly defaultDeploySource: string | null = defaultDeploy.deploySource;
    public static readonly localConfig = "local.json";
    
    public static fetchRemote() : Promise<boolean> {
        return new Promise(resolve => {
            Utils.getConfig()
            .then(config => {
                const remote = config?.deploySource || this.defaultDeploySource;
                if (remote === null) {
                    resolve(false);
                    Utils.log("No deploy source set.");
                    return;
                }
            })
        })
    }
}
