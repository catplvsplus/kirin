import path from 'node:path';
import { ServerManager } from './dist/index.mjs';

const servers = new ServerManager({
    root: './servers'
});

const versions = await servers.downloads.paper.fetchVersions();
const builds = await servers.downloads.paper.fetchBuilds(versions.first()![0]);

const build = builds[0];

if (!build) throw new Error('No builds found');

console.log('Downloading server...');

const directory = path.join(servers.root, 'server');

await servers.downloads.download(
    build.downloads['server:default'].url,
    {
        directory,
        filename: 'server.jar',
        checksum: {
            type: 'sha256',
            hash: build.downloads['server:default'].checksums.sha256
        }
    }
);