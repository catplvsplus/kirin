import { Collection } from '@discordjs/collection';
import type { Server } from '../Server.js';
import { DownloadManager } from './DownloadManager.js';

export class ServerManager {
    public downloads: DownloadManager = new DownloadManager(this);

    public servers: Collection<string, Server> = new Collection();
}