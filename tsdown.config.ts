import { defineConfig } from 'tsdown';

export default defineConfig({
    clean: true,
    entry: ['./src/index.ts'],
    outDir: './dist',
    tsconfig: './tsconfig.json',
    skipNodeModulesBundle: true,
    format: ['esm'],
    nodeProtocol: true,
    platform: 'node',
    dts: true,
})