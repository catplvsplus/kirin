import path from 'node:path';
import { ServerManager } from './dist/index.mjs';

const servers = new ServerManager();

const versions = await servers.downloads.paper.fetchVersions();
const builds = await servers.downloads.paper.fetchBuilds(servers.downloads.paper.versions.first()![0]);

const build = builds[0];

if (!build) throw new Error('No builds found');


await servers.downloads.download(
    build.downloads['server:default'].url,
    path.join(process.cwd(), 'server', build.downloads['server:default'].name)
);

console.log(`Server version: ${versions.first()![0]}`);
console.log(`Server build: ${builds[0].id}`);