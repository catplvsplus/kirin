# @kirinmc/core

A simple minecraft server manager library for [node.js](https://nodejs.org/).

## Examples

- [Kirin Bot](https://github.com/catplvsplus/kirin-bot) A Minecraft server manager in Discord.

## Installation

```bash
npm install @kirinmc/core
```

## Usage

```ts
import { ServerManager } from '@kirinmc/core';

const servers = new ServerManager({
    root: './servers'
});

await servers.load();                       // Load saved servers
await servers.save();                       // Save servers

await servers.add({
    id: "my-server",                        // The ID of the server (should be unique)
    name: "My Server",                      // The display name of the server
    directory: "my-server",                 // The directory to save the server to (relative to server manager root)
    command: "java -jar server.jar",        // The command to start the server
    persist: true,                          // Should the server stop when the process exits
    type: "java",                           // Server type (java, bedrock)
    env: {},                                // Add environment variables here
    address: "localhost:25565",             // The address of the server to ping
    pingInterval: 60000                     // How often to ping the server for status in milliseconds
}); // Add a server

const myServer = servers.get("my-server");  // Get a server by ID

await myServer.start();                     // Start a server
await myServer.stop();                      // Stop a server

await servers.delete("my-server");          // Delete a server (Does not stop the server).
```
