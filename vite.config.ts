import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), basicSsl()],
  server: {
    proxy: {
      '/webhook': {
        target: 'https://sterling.braceyourself.solutions',
        changeOrigin: true,
        secure: false, // if your backend has a self-signed cert (otherwise leave out)
        rewrite: (path) => path.replace(/^\/webhook/, '/webhook'),
      }
    }
  },
})
