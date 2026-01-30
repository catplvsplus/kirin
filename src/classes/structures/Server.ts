import { tokenizeArgs } from 'args-tokenizer';
import EventEmitter from 'node:events';
import { x, type Result } from 'tinyexec';
import type { ServerManager } from '../managers/ServerManager.js';

export class Server extends EventEmitter<Server.Events> {
    public process: Result|null = null;

    public id: string;
    public name: string;
    public directory: string;
    public command: string;
    public persist: boolean;
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
        this.persist = data.persist ?? false;
        this.protocol = data.protocol;
        this.address = data.address;
    }

    public async start(): Promise<void> {
        if (this.isRunning) {
            throw new Error(`Server is already running.`);
        }

        const [command, ...args] = tokenizeArgs(this.command);

        this.process = x(command, args, {
            nodeOptions: {
                cwd: this.directory
            },
            persist: this.persist
        });

        this.emit('processStart', this.process);

        this.process.process?.stdout?.on('data', (data) => this.emit('processStdout', data.toString().trimEnd()));
        this.process.process?.stderr?.on('data', (data) => this.emit('processStderr', data.toString().trimEnd()));

        this.process.process?.on('close', () => {
            this.emit('processStop', this.process);
            this.process = null;
        });
    }

    public async stop(): Promise<void> {
        if (!this.isRunning) return;

        this.process?.kill();

        const data = await this.process;

        if (data?.exitCode) {
            throw new Error(`Server exited with code ${data.exitCode}`);
        }
    }

    public toJSON(): Server.Data {
        return {
            id: this.id,
            name: this.name,
            directory: this.directory,
            command: this.command,
            persist: this.persist,
            protocol: this.protocol,
            address: this.address
        };
    }
}

export namespace Server {
    export interface Events {
        processStart: [process: Result];
        processStop: [process: Result|null];
        processStdout: [data: string];
        processStderr: [data: string];
    }

    export interface Data {
        id: string;
        name: string;
        directory: string;
        command: string;
        persist: boolean;
        protocol: Server.Protocol;
        address: string;
    }

    export type Protocol = 'java'|'bedrock';
}