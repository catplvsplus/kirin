import { VelocityDownloader } from '../downloaders/VelocityDownloader.js';
import { PaperDownloader } from '../downloaders/PaperDownloader.js';
import { copyFile, mkdir, stat } from 'node:fs/promises';
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
        const hash = crypto.createHash('sha256').update(url).digest('hex');
        const location = path.join(this.cacheDir, hash);
        return location;
    }

    public async download(url: string, location: string, options?: DownloadManager.DownloadOptions): Promise<void> {
        let stats = await stat(location).catch(() => null);

        const directory = stats?.isDirectory()
            ? location
            : path.dirname(location);
        const filename = stats?.isFile()
            ? path.basename(location)
            : path.basename(new URL(url).pathname);

        if (!stats) {
            await mkdir(directory, { recursive: true });
        } else {
            if (!options?.throwIfExists) return;

            throw new Error(`File already exists at ${location}`)
        }

        const destination = path.join(directory, filename);
        const cachePath = await this.getCachePath(url);

        if (options?.useCache !== false) {
            const isCacheExists = await stat(cachePath).then(d => d.isFile()).catch(() => false);

            if (!isCacheExists) {
                const response = await fetch(url);
                if (!response.ok) throw Error('Failed to download file', { cause: response });
                if (!response.body) throw Error('No response body');

                await mkdir(path.dirname(cachePath), { recursive: true });
                await this.writeToFile(response.body, cachePath);
            }

            await copyFile(cachePath, destination);
        } else {
            const response = await fetch(url);
            if (!response.ok) throw Error('Failed to download file', { cause: response });
            if (!response.body) throw Error('No response body');

            await this.writeToFile(response.body, destination);
        }

        if (options?.checksum) {
            if (!await this.verify(destination, options.checksum)) {
                throw new Error('Checksum mismatch');
            }
        }
    }

    public async writeToFile(stream: ReadableStream<Uint8Array<ArrayBuffer>>, location: string): Promise<void> {
        const writeStream = createWriteStream(location);

        for await (const chunk of stream) {
            writeStream.write(chunk);
        }

        writeStream.end();

        await new Promise<void>((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });
    }
}

export namespace DownloadManager {
    export interface DownloadOptions {
        throwIfExists?: boolean;
        useCache?: boolean;
        checksum?: {
            type: string;
            hash: string;
        }
    }
}