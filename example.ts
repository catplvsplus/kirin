import path from 'node:path';
import { styleText } from 'node:util';
import { Server, ServerManager } from './dist/index.mjs';

const servers = new ServerManager('./servers');

await servers.load();

if (servers.servers.size === 0) {
    console.log('No servers found, creating one...');

    const versions = await servers.downloads.paper.fetchVersions();
    const builds = await servers.downloads.paper.fetchBuilds(versions.first()![0]);

    const build = builds[0];

    if (!build) throw new Error('No builds found');

    console.log('Downloading server...');

    const directory = path.join(servers.root, 'server');

    await servers.downloads.download(
        build.downloads['server:default'].url,
        path.join(directory, build.downloads['server:default'].name),
        {
            checksum: {
                type: 'sha256',
                hash: build.downloads['server:default'].checksums.sha256
            }
        }
    );

    const server = new Server({
        id: `my-server`,
        name: 'server',
        address: 'localhost:25565',
        directory: 'server',
        type: 'java',
        persist: true,
        env: {},
        command: `java -XX:+AlwaysPreTouch -XX:+DisableExplicitGC -XX:+ParallelRefProcEnabled -XX:+PerfDisableSharedMem -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1HeapRegionSize=8M -XX:G1HeapWastePercent=5 -XX:G1MaxNewSizePercent=40 -XX:G1MixedGCCountTarget=4 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1NewSizePercent=30 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:G1ReservePercent=20 -XX:InitiatingHeapOccupancyPercent=15 -XX:MaxGCPauseMillis=200 -XX:MaxTenuringThreshold=1 -XX:SurvivorRatio=32 -jar ${build.downloads['server:default'].name}`,
        pingInterval: 60000
    }, servers);

    servers.servers.set(server.id, server);
    await servers.save();
}

const server = servers.servers.get('my-server')!;

await server.start();

server.on('processStdout', (data) => console.log(data));
server.on('processStderr', (data) => console.error(data));
server.on('processStart', () => console.log(styleText('green', 'Server started!')));
server.on('processStop', (process, reason) => console.log(styleText('red', 'Server stopped!'), reason));
server.on('pingUpdate', (data) => console.log(styleText('green', `Server ping: ${data.latency}ms; Status: ${data.status}; ${data.players?.online || 0}/${data.players?.max || 0}`)));
server.on('statusUpdate', (status) => console.log(styleText('cyan', `Server status: ${status}`)));

process.on('SIGINT', async () => {
    await server.stop();
});