import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [ vue() ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: {
      '/local': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/local/, '/'),
      },
      '/ahocevar': {
        target: 'https://ahocevar.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ahocevar/, '/'),
      },
      '/api': {
        target: 'http://117.72.108.239:3001', // 后端服务器的 HTTP 地址
        changeOrigin: true,
        secure: false,  // 因为后端没有 SSL，所以 secure 设置为 false
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
