import { Collection } from '@discordjs/collection';
import { Server } from '../structures/Server.js';
import { DownloadManager } from './DownloadManager.js';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import EventEmitter from 'node:events';

export class ServerManager extends EventEmitter<ServerManager.Events> {
    public downloads: DownloadManager = new DownloadManager(this);
    public servers: Collection<string, Server> = new Collection();

    get configPath() {
        return path.join(this.root, 'servers.json');
    }

    constructor(public root: string) {
        super();

        this.root = root;
    }

    public async delete(id: string): Promise<Server|null> {
        const server = this.servers.get(id);
        if (!server) return null;

        this.servers.delete(id);
        this.emit('serverDelete', server);

        await this.save();
        return server;
    }

    public async load(): Promise<Collection<string, Server>> {
        const result = new Collection<string, Server>();
        const exists = await stat(this.root)
            .then(d => d.isDirectory())
            .catch(() => false);

        if (!exists) {
            await mkdir(this.root, { recursive: true });
            await writeFile(this.configPath, '[]');
            return result;
        }

        const servers: Server.Data[] = await readFile(this.configPath, 'utf-8')
            .then(JSON.parse)
            .catch(() => []);

        for (const rawData of servers) {
            const data = Server.schema.parse(rawData);

            const server = this.servers.get(data.id)?.edit(data) ?? new Server(data, this);

            this.servers.set(data.id, server);
            result.set(data.id, server);

            if (!this.servers.has(data.id)) this.emit('serverCreate', server);
        }

        return result;
    }

    public async save(): Promise<void> {
        await mkdir(path.dirname(this.configPath), { recursive: true });
        await writeFile(
            this.configPath,
            JSON.stringify(
                this.servers.values().map(v => v.toJSON()).toArray(),
                null,
                2
            )
        );
    }
}

export namespace ServerManager {
    export interface Events {
        serverCreate: [server: Server];
        serverDelete: [server: Server];
    }
}