import { Collection } from '@discordjs/collection';
import { Server } from '../structures/Server.js';
import { DownloadManager } from './DownloadManager.js';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export class ServerManager {
    public downloads: DownloadManager = new DownloadManager(this);
    public servers: Collection<string, Server> = new Collection();

    get configPath() {
        return path.join(this.root, 'servers.json');
    }

    constructor(public root: string) {
        this.root = root;
    }

    public async load(): Promise<void> {
        const servers = await this.readConfig();

        for (const server of servers) {
            this.servers.set(server.id, new Server(server, this));
        }
    }

    public async createServer(data: Server.Data): Promise<void> {
        const server = new Server(data, this);

        this.servers.set(data.id, server);

        await this.writeConfig(this.servers.map(s => s.toJSON()));
    }

    public async readConfig(): Promise<Server.Data[]> {
        const exists = await stat(this.root)
            .then(d => d.isDirectory())
            .catch(() => false);

        if (!exists) {
            await mkdir(this.root, { recursive: true });
            await writeFile(this.configPath, '[]');
            return [];
        }

        return readFile(this.configPath, 'utf-8')
            .then(JSON.parse)
            .catch(() => []);
    }

    public async writeConfig(servers: Server.Data[]): Promise<void> {
        await writeFile(this.configPath, JSON.stringify(servers));
    }
}

export namespace ServerManager {}