import { defineConfig } from 'tsdown';

export default defineConfig({
    clean: true,
    entry: ['./src/index.ts'],
    outDir: './dist',
    tsconfig: './tsconfig.json',
    skipNodeModulesBundle: true,
    nodeProtocol: true,
    platform: 'node',
    dts: true,
})