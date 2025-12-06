import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { resolve } from 'path';

export default defineConfig({
    // basicSsl generates a trusted-ish self-signed cert for local dev; no manual cert files needed.
    plugins: [basicSsl(), vue()],
    envDir: resolve(__dirname, '..'),
    server: {
        port: 5173,
        https: true,
        proxy: {
            // Proxy narrative-service during dev to avoid CORS/mixed-content from https dev origin.
            '/narrative': {
                target: 'http://localhost:8081',
                changeOrigin: true,
                secure: false,
                rewrite: path => path.replace(/^\/narrative/, '')
            }
        }
    }
});
