import JavaProtocol from 'minecraft-protocol';
import BedrockProtocol from 'bedrock-protocol';
import type { Server } from './Server.js';

export class Ping {
    public latest: Ping.PingData|null = null;
    public interval: NodeJS.Timeout|null = null;
    public timeout: number = 10000;

    constructor(public server: Server) {}

    public async ping(): Promise<Ping.PingData> {
        const data = this.server.protocol === 'java'
            ? await Ping.pingJava({
                host: this.server.hostname,
                port: this.server.port,
                timeout: this.timeout
            })
            : await Ping.pingBedrock({
                host: this.server.hostname,
                port: this.server.port,
                timeout: this.timeout
            });

        this.server.emit('pingUpdate', data);

        return this.latest = data;
    }

    public start(interval: number): void {
        this.stop();
        this.ping();
        this.interval = setInterval(() => this.ping(), interval).unref();
    }

    public stop(): void {
        if (this.interval) clearInterval(this.interval);
    }
}

export namespace Ping {
    export type Status = 'online'|'offline';

    export interface PingData {
        status: Status;
        protocol: Server.Protocol;
        address: string;
        players: {
            max: number;
            online: number;
            sample: Record<'id'|'name', string>[];
        }|null;
        motd: string|null;
        version: string|null;
        versionProtocol: number|null;
        latency: number;
        createdAt: number;
    }

    export interface PingOptions {
        host: string;
        port?: number|null;
        timeout?: number;
    }

    export async function pingJava(options: PingOptions): Promise<PingData> {
        const pinged = Date.now();
        const response = await JavaProtocol.ping({
            host: options.host,
            port: options.port ?? undefined,
            closeTimeout: options.timeout
        }).catch(() => null);

        let data: PingData = {
            status: 'offline',
            protocol: 'java',
            address: `${options.host}${options.port ? `:${options.port}` : ''}`,
            players: null,
            motd: null,
            version: null,
            versionProtocol: null,
            latency: Date.now() - pinged,
            createdAt: Date.now()
        };

        if (!response) {
            return data;
        } else if (!('players' in response)) {
            data.version = response.version;
            data.versionProtocol = response.protocol;
            data.motd = response.motd;
            data.players = {
                max: response.maxPlayers,
                online: response.playerCount,
                sample: []
            };

            return data;
        }

        data.players = {
            max: response.players.max,
            online: response.players.online,
            sample: response.players.sample || []
        };

        data.motd = typeof response.description === 'string'
            ? response.description
            : response.description.text ?? null;

        data.version = response.version.name;
        data.versionProtocol = response.version.protocol;
        data.latency = response.latency;
        data.status = response.players.max ? 'online' : 'offline';

        return data;
    }

    export async function pingBedrock(options: PingOptions): Promise<PingData> {
        const pinged = Date.now();
        const response = await BedrockProtocol.ping({
            host: options.host,
            port: options.port ?? 19132
        }).catch(() => null);

        let data: PingData = {
            status: 'offline',
            protocol: 'bedrock',
            address: `${options.host}:${options.port ?? 19132}`,
            players: null,
            motd: null,
            version: null,
            versionProtocol: null,
            latency: Date.now() - pinged,
            createdAt: Date.now()
        };

        if (!response) return data;

        data.players = {
            max: response.playersMax,
            online: response.playersOnline,
            sample: []
        };

        data.motd = response.motd || null;
        data.version = response.version;
        data.versionProtocol = response.protocol;
        data.status = response.playersMax ? 'online' : 'offline';

        return data;
    }
}