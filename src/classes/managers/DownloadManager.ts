import { VelocityDownloader } from '../downloaders/VelocityDownloader.js';
import { PaperDownloader } from '../downloaders/PaperDownloader.js';
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import type { ServerManager } from './ServerManager.js';
import { createReadStream, createWriteStream } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

export class DownloadManager {
    public paper: PaperDownloader = new PaperDownloader(this);
    public velocity: VelocityDownloader = new VelocityDownloader(this);

    get cacheDir() {
        return path.join(this.servers.root, '.cache');
    }

    constructor(public servers: ServerManager) {}

    public async verify(file: string, checksum: Exclude<DownloadManager.DownloadOptions['checksum'], undefined>): Promise<boolean> {
        const hash = crypto.createHash(checksum.type);

        const readStream = createReadStream(file);

        for await (const chunk of readStream) {
            hash.update(chunk);
        }

        return hash.digest('hex') === checksum.hash;
    }

    public async getCachePath(url: string): Promise<string> {
        const location = path.join(this.cacheDir, await this.getURLHash(url));

        const exists = await stat(location).then(d => d.isDirectory()).catch(() => false);
        if (!exists) throw new Error(`Cache not found: ${location}`);

        const file = await readdir(location);
        if (!file.length) throw new Error('Cache is empty');

        return path.join(location, file[0]);
    }

    public async getURLHash(url: string): Promise<string> {
        return crypto.createHash('sha256').update(url).digest('hex');
    }

    public async download(url: string, options: DownloadManager.DownloadOptions): Promise<string> {
        let { directory, filename } = options;

        const stats = await stat(directory).catch(() => null);
        if (!stats) await mkdir(directory, { recursive: true });

        const cachePath = options?.useCache === false ? null : await this.getCachePath(url).catch(() => null);
        const checkIfExists = async () => {
            if (options.throwIfExists !== false) {
                const exists = await stat(path.join(directory, filename!)).then(d => d.isFile()).catch(() => false);
                if (exists) throw new Error('File already exists');
            }
        }

        if (cachePath) {
            filename ??= path.basename(cachePath);

            await checkIfExists();
            await copyFile(cachePath, path.join(directory, filename));
        } else {
            const response = await fetch(url);
            const disposition = response.headers.get('content-disposition');

            if (!response.ok) throw Error('Failed to download file', { cause: response });
            if (!response.body) throw Error('No response body');

            const name = (disposition?.match(/filename="(.+)"/)?.[1] ?? path.basename(new URL(url).pathname)) || `file-${Date.now()}`;

            filename ??= name;

            await checkIfExists();

            if (options.useCache !== false) {
                const location = path.join(this.cacheDir, await this.getURLHash(url));

                await mkdir(location, { recursive: true });
                await this.writeToFile(response.body, path.join(location, name));
                await copyFile(path.join(location, name), path.join(directory, filename));
            } else {
                await this.writeToFile(response.body, path.join(directory, filename));
            }
        }

        if (options?.checksum) {
            if (!await this.verify(path.join(directory, filename), options.checksum)) {
                throw new Error('Checksum mismatch');
            }
        }

        return path.join(directory, filename);
    }

    public async writeToFile(stream: ReadableStream<Uint8Array<ArrayBuffer>>, location: string): Promise<void> {
        const writeStream = createWriteStream(location);

        for await (const chunk of stream) {
            writeStream.write(chunk);
        }

        writeStream.end();

        let resolve: (() => void)|null = null;
        let reject: ((reason?: any) => void)|null = null;

        const promise =  new Promise<void>((res, rej) => {
            resolve = res;
            reject = rej;
        });

        const resolveWrapper = () => {
            resolve?.();
            writeStream.off('finish', resolveWrapper);
            writeStream.off('error', rejectWrapper);
        };

        const rejectWrapper = (reason?: any) => {
            reject?.(reason);
            writeStream.off('finish', resolveWrapper);
            writeStream.off('error', rejectWrapper);
        };

        writeStream.on('finish', resolveWrapper);
        writeStream.on('error', rejectWrapper);

        await promise;
    }
}

export namespace DownloadManager {
    export interface DownloadOptions {
        directory: string;
        filename?: string;
        throwIfExists?: boolean;
        useCache?: boolean;
        checksum?: {
            type: string;
            hash: string;
        };
    }
}