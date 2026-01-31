import { tokenizeArgs } from 'args-tokenizer';
import EventEmitter from 'node:events';
import { x, type Result } from 'tinyexec';
import type { ServerManager } from '../managers/ServerManager.js';
import { config as dotenv } from '@dotenvx/dotenvx';

export class Server extends EventEmitter<Server.Events> {
    public process: Result|null = null;

    public id: string;
    public name: string;
    public directory: string;
    public command: string;
    public persist: boolean;
    public env: Record<string, string>|string;
    public protocol: Server.Protocol;
    public address: string;

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

    constructor(data: Server.Data, public servers: ServerManager) {
        super();

        this.id = data.id;
        this.name = data.name;
        this.directory = data.directory;
        this.command = data.command;
        this.persist = data.persist;
        this.env = data.env;

        this.protocol = data.protocol;
        this.address = data.address;
    }

    public async start(): Promise<void> {
        if (this.isRunning) throw new Error(`Server is already running.`);

        const [command, ...args] = tokenizeArgs(this.command);
        const env = typeof this.env === 'string' ? dotenv({ path: this.env, processEnv: {} }).parsed : this.env;

        this.process = x(command, args, {
            nodeOptions: {
                cwd: this.directory,
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
            this.emit('processStart', this.process!);
        });

        const onStop = (reason?: Error) => {
            this.emit('processStop', this.process!, reason);
            this.process = null;
        };

        this.process.then(() => onStop(), reason => onStop(reason));
    }

    public async stop(): Promise<number|null> {
        if (!this.isRunning) return null;

        const process = this.process;

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
            protocol: this.protocol,
            env: this.env,
            address: this.address
        };
    }
}

export namespace Server {
    export interface Events {
        processStart: [process: Result];
        processStop: [process: Result, reason?: Error];
        processStdout: [data: string];
        processStderr: [data: string];
    }

    export interface Data {
        id: string;
        name: string;
        directory: string;
        command: string;
        persist: boolean;
        env: Record<string, string>|string;
        protocol: Server.Protocol;
        address: string;
    }

    export type Protocol = 'java'|'bedrock';
}