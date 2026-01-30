import { Collection } from '@discordjs/collection';
import type { DownloadManager } from '../managers/DownloadManager.js';

export class PaperDownloader {
    public versions: Collection<string, string[]> = new Collection();
    public builds: Collection<string, PaperDownloader.BuildResponseData[]> = new Collection();

    constructor(public downloads: DownloadManager) {}

    public async fetchVersions(): Promise<Collection<string, string[]>> {
        if (this.versions.size > 0) return this.versions;

        const response = await fetch('https://fill.papermc.io/v3/projects/paper');
        if (!response.ok) throw Error('Failed to fetch versions', { cause: response });

        const data: PaperDownloader.VersionsResponseData = await response.json();

        for (const [version, releases] of Object.entries(data.versions)) {
            this.versions.set(version, releases);
        }

        return this.versions;
    }

    public async fetchBuilds(version: string): Promise<PaperDownloader.BuildResponseData[]> {
        if (this.builds.has(version)) return this.builds.get(version)!;

        const response = await fetch(`https://fill.papermc.io/v3/projects/paper/versions/${version}/builds`);
        if (!response.ok) throw Error('Failed to fetch builds', { cause: response });

        const data: PaperDownloader.BuildResponseData[] = await response.json();

        this.builds.set(version, data);
        return data;
    }
}

export namespace PaperDownloader {
    export interface VersionsResponseData {
        project: Record<'id'|'name', string>;
        versions: Record<'version', string[]>;
    }

    export interface BuildResponseData {
        id: number;
        time: string;
        channel: 'STABLE'|'BETA'|'ALPHA';
        commits: {
            sha: string;
            time: string;
            message: string;
        }[];
        downloads: Record<'server:default', {
            name: string;
            checksum: Record<'sha256', string>;
            size: number;
            url: string;
        }>;
    }
}