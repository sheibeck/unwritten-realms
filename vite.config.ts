import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), basicSsl()],
  server: {
    proxy: {
      // Proxy assistant endpoints to engine server to avoid CORS in dev
      '/assistant': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
