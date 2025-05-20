import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

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
      // 修改后的 /api 代理规则
      '/api': {
        target: 'https://kexiaohua.online',
        changeOrigin: true,
        secure: false
        // 没有 rewrite 规则，保持 /api 前缀不变
      }
    }
  }
})
