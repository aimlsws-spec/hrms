import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8004',
        changeOrigin: true,
        timeout: 180000,      // 3 min — docx2pdf PDF generation can take 60-90 s
        proxyTimeout: 180000,
      },
      '/auth': {
        target: 'http://127.0.0.1:8004',
        changeOrigin: true,
        timeout: 30000,
        proxyTimeout: 30000,
      },
      '/uploads': {
        target: 'http://127.0.0.1:8004',
        changeOrigin: true,
      },
      '/images': {
        target: 'http://127.0.0.1:8004',
        changeOrigin: true,
      },
    },
  },
})
