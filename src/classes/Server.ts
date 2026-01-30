import { tokenizeArgs } from 'args-tokenizer';
import { x, type Result } from 'tinyexec';

export class Server {
    public process: Result|null = null;

    public directory: string;
    public command: string;
    public persist: boolean;

    get isRunning(): boolean {
        return this.process !== null && !this.process.killed;
    }

    constructor(options: Server.Data) {
        this.directory = options.directory;
        this.command = options.command;
        this.persist = options.persist ?? false;
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
    }

    public async stop(): Promise<void> {
        if (!this.isRunning) return;

        this.process?.kill();

        await new Promise<void>((resolve, reject) => {
            this.process?.process?.on('error', reject);
            this.process?.process?.on('exit', code => !code
                ? resolve()
                : reject(new Error(`Process exited with code ${code}`))
            );
            this.process?.process?.on('close', code => !code
                ? resolve()
                : reject(new Error(`Process exited with code ${code}`))
            );
        });
    }
}

export namespace Server {
    export interface Data {
        directory: string;
        command: string;
        persist?: boolean;
    }
}