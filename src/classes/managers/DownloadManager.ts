import path from 'node:path';
import { PaperDownloader } from '../downloaders/PaperDownloader.js';
import { mkdir, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import type { ServerManager } from './ServerManager.js';

export class DownloadManager {
    public paper: PaperDownloader = new PaperDownloader(this);

    constructor(public servers: ServerManager) {}

    public async download(url: string, location: string, throwIfExists: boolean = false): Promise<void> {
        const response = await fetch(url);
        if (!response.ok) throw Error('Failed to download file', { cause: response });

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
            if (!throwIfExists) return;

            throw new Error(`File already exists at ${location}`)
        }

        const writeStream = createWriteStream(path.join(directory, filename));

        for await (const chunk of response.body!) {
            writeStream.write(chunk);
        }

        writeStream.end();

        await new Promise<void>((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });
    }
}