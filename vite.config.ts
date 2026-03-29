import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            'fs': 'rollup-plugin-node-polyfills/polyfills/empty',
            'path': 'path-browserify'
        },
    },
    build: {
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
                paperdoll: path.resolve(__dirname, 'paperdoll.html'),
            },
        },
    },
    server: {
        port: 5173,
        open: true,
    },
});
