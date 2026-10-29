import { defineConfig } from 'vite';

export default defineConfig({
    root: 'src',
    base: process.env.VITE_BASE || '/',
    build: {
        outDir: '../dist',
        emptyOutDir: true
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true
            }
        }
    }
});
