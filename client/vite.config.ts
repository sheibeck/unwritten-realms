import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
    plugins: [vue()],
    envDir: resolve(__dirname, '..'),
    server: {
        port: 5173
    }
});
