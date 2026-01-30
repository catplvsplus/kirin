import path from 'node:path';
import { Server, ServerManager } from './dist/index.mjs';
import { randomUUID } from 'node:crypto';

const servers = new ServerManager('./servers');

const versions = await servers.downloads.paper.fetchVersions();
const builds = await servers.downloads.paper.fetchBuilds(servers.downloads.paper.versions.first()![0]);

const build = builds[0];

if (!build) throw new Error('No builds found');


console.log('Downloading server...');

await servers.downloads.download(
    build.downloads['server:default'].url,
    path.join(process.cwd(), 'server', build.downloads['server:default'].name)
);

console.log('Done!');
const server = new Server({
    id: randomUUID(),
    name: 'server',
    address: 'localhost:25565',
    directory: path.join(process.cwd(), 'server'),
    command: `java -XX:+AlwaysPreTouch -XX:+DisableExplicitGC -XX:+ParallelRefProcEnabled -XX:+PerfDisableSharedMem -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1HeapRegionSize=8M -XX:G1HeapWastePercent=5 -XX:G1MaxNewSizePercent=40 -XX:G1MixedGCCountTarget=4 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1NewSizePercent=30 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:G1ReservePercent=20 -XX:InitiatingHeapOccupancyPercent=15 -XX:MaxGCPauseMillis=200 -XX:MaxTenuringThreshold=1 -XX:SurvivorRatio=32 -jar ${build.downloads['server:default'].name}`
});

servers.servers.set(server.id, server)

await server.start();

console.log('Server started!');

server.on('processStdout', (data) => console.log(data));
server.on('processStderr', (data) => console.error(data));