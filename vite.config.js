import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  base: './',
  plugins: [ vue() ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    // 确保处理 SVG 资源
    assetsInlineLimit: 0, // 不内联任何资源
  },
  publicDir: 'public', // 确保正确指定公共资源目录
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
