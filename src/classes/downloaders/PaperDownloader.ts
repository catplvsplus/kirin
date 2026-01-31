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

    public async fetchLatestBuild(): Promise<PaperDownloader.BuildResponseData|null> {
        const release = (await this.fetchVersions()).first()?.at(0);
        if (!release) return null;

        const build = (await this.fetchBuilds(release)).at(0);
        if (!build) return null;

        return build;
    }

    public async downloadLatest(location: string, options?: Omit<DownloadManager.DownloadOptions, 'checksum'>): Promise<void> {
        const build = await this.fetchLatestBuild();
        if (!build) throw new Error('No builds found');

        const url = build.downloads['server:default'].url;
        const checksum = {
            type: 'sha256',
            hash: build.downloads['server:default'].checksums['sha256']
        };

        await this.downloads.download(
            url,
            location,
            {
                checksum,
                ...options
            }
        );
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
            checksums: Record<'sha256', string>;
            size: number;
            url: string;
        }>;
    }
}