import { tokenizeArgs } from 'args-tokenizer';
import EventEmitter from 'node:events';
import { x, type Output, type Result } from 'tinyexec';
import type { ServerManager } from '../managers/ServerManager.js';
import { config as dotenv } from '@dotenvx/dotenvx';
import type Stream from 'node:stream';
import { Ping } from './Ping.js';
import z from 'zod';
import path from 'node:path';

export class Server extends EventEmitter<Server.Events> {
    public process: Result|null = null;
    public ping: Ping = new Ping(this);
    public stopping: boolean = false;

    public id: string;
    public name: string;
    public directory: string;
    public command: string;
    public persist: boolean;
    public env: Record<string, string>|string;
    public type: Server.Type;
    public address: string;
    public pingInterval: number;

    get isRunning(): boolean {
        return this.process !== null && !this.process.killed;
    }

    get hostname(): string {
        return this.address.split(':')[0];
    }

    get port(): number|null {
        const port = Number(this.address.split(':')[1]);
        return !isNaN(port) ? port : null;
    }

    get stdout(): Stream.Readable|null {
        return this.process?.process?.stdout ?? null;
    }

    get stderr(): Stream.Readable|null {
        return this.process?.process?.stderr ?? null;
    }

    get stdin(): Stream.Writable|null {
        return this.process?.process?.stdin ?? null;
    }

    get status(): Server.Status {
        if (this.isRunning && !this.stopping) {
            if (this.ping.latest?.status == 'online') return 'online';
            if (this.ping.latest?.status == 'offline') return 'starting';
        }

        if (this.isRunning && this.stopping) return 'stopping';

        if (!this.isRunning) {
            if (this.ping.latest?.status == 'offline') return 'offline';
            if (this.ping.latest?.status == 'online') return 'detached';
        }

        return 'offline';
    }

    constructor(data: Server.Data, public servers: ServerManager) {
        super();

        this.id = data.id;
        this.name = data.name;
        this.directory = data.directory;
        this.command = data.command;
        this.persist = data.persist;
        this.env = data.env;

        this.type = data.type;
        this.address = data.address;
        this.pingInterval = data.pingInterval;


        this.ping.start(this.pingInterval);
    }

    public async start(): Promise<void> {
        if (this.isRunning) throw new Error(`Server is already running.`);

        let resolveStart: () => void;
        let rejectStart: (reason?: any) => void;

        const [command, ...args] = tokenizeArgs(this.command);
        const env = typeof this.env === 'string' ? dotenv({ path: this.env, processEnv: {} }).parsed : this.env;
        const startedPromise = new Promise<void>((resolve, reject) => {
            resolveStart = resolve;
            rejectStart = reject;
        });

        this.process = x(command, args, {
            nodeOptions: {
                cwd: path.join(this.servers.root, this.directory),
                env: {
                    ...process.env,
                    ...env
                }
            },
            persist: this.persist
        });

        this.process.process?.stdout?.on('data', (data) => this.emit('processStdout', data.toString().trimEnd()));
        this.process.process?.stderr?.on('data', (data) => this.emit('processStderr', data.toString().trimEnd()));

        this.process.process?.on('spawn', () => {
            this.ping.start(this.pingInterval);
            this.emit('processStart', this.process!);
            this.emit('statusUpdate', this.status);
            resolveStart();
        });

        const onStop = (reason: Output|Error) => {
            this.process = null;
            this.stopping = false;
            this.ping.latest = Ping.createOfflineData(
                {
                    host: this.hostname,
                    port: this.port
                },
                this.type
            );

            this.emit('processStop', this.process!, reason);
            this.emit('statusUpdate', this.status);
        };

        this.process.then(
            output => {
                onStop(output);
                rejectStart(new Error('Process exited unexpectedly.'));
            },
            error => {
                error = error instanceof Error ? error : new Error(String(error));

                onStop(error);
                rejectStart(error);
            }
        );
    }

    public async stop(): Promise<number|null> {
        if (!this.isRunning) return null;

        this.stopping = true;

        const process = this.process;

        this.emit('statusUpdate', this.status);
        process?.kill();

        return new Promise((resolve, reject) => this.process?.then(
            () => resolve(process?.exitCode ?? null),
            reject
        ));
    }

    public edit(data: Partial<Server.Data>): this {
        if (data.id && data.id !== this.id) throw new Error('Cannot change server ID.');

        Object.assign(this, data);
        return this;
    }

    public toJSON(): Server.Data {
        return {
            id: this.id,
            name: this.name,
            directory: this.directory,
            command: this.command,
            persist: this.persist,
            type: this.type,
            env: this.env,
            address: this.address,
            pingInterval: this.pingInterval
        };
    }
}

export namespace Server {
    export type Status = 'online'|'offline'|'starting'|'stopping'|'detached';

    export interface Events {
        processStart: [process: Result];
        processStop: [process: Result, reason?: Output|Error];
        processStdout: [data: string];
        processStderr: [data: string];
        pingUpdate: [data: Ping.PingData];
        statusUpdate: [status: Status];
    }

    export interface Data {
        id: string;
        name: string;
        directory: string;
        command: string;
        persist: boolean;
        env: Record<string, string>|string;
        type: Server.Type;
        address: string;
        pingInterval: number;
    }

    export type Type = 'java'|'bedrock';

    export const schema = z.object({
        id: z.string(),
        name: z.string(),
        directory: z.string(),
        command: z.string(),
        persist: z.boolean(),
        env: z.union([
            z.record(z.string(), z.string()),
            z.string(),
        ]),
        type: z.union([
            z.literal('java'),
            z.literal('bedrock')
        ]),
        address: z.string(),
        pingInterval: z.number()
    })
}