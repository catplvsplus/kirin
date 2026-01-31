import { PaperDownloader } from '../downloaders/PaperDownloader.js';
import { copyFile, mkdir, stat } from 'node:fs/promises';
import type { ServerManager } from './ServerManager.js';
import { createReadStream, createWriteStream } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

export class DownloadManager {
    public paper: PaperDownloader = new PaperDownloader(this);
    public cacheDir: string;

    constructor(public servers: ServerManager) {
        this.cacheDir = path.join(servers.root, '.cache');
    }

    public async verify(file: string, checksum: Exclude<DownloadManager.DownloadOptions['checksum'], undefined>): Promise<boolean> {
        const hash = crypto.createHash(checksum.type);

        const readStream = createReadStream(file);

        for await (const chunk of readStream) {
            hash.update(chunk);
        }

        return hash.digest('hex') === checksum.hash;
    }

    public async getCachePath(url: string): Promise<string|null> {
        const hash = crypto.createHash('sha256').update(url).digest('hex');
        const location = path.join(this.cacheDir, hash);

        const exists = await stat(location).then(d => d.isFile()).catch(() => false);
        if (!exists) return null;

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

        if (cachePath && options?.useCache !== false) {
            await copyFile(cachePath, destination);
        } else {
            const response = await fetch(url);
            if (!response.ok) throw Error('Failed to download file', { cause: response });

            const writeStream = createWriteStream(destination);

            for await (const chunk of response.body!) {
                writeStream.write(chunk);
            }

            writeStream.end();

            await new Promise<void>((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });
        }

        if (options?.checksum) {
            if (!await this.verify(destination, options.checksum)) {
                throw new Error('Checksum mismatch');
            }
        }
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