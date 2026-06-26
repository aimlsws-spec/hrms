import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      // Forward any /api/* or /health* calls to the FastAPI backend.
      // This means even plain /api/... fetch calls (without full URL) work.
      '/api': {
        target: 'http://127.0.0.1:8004',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8004',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://127.0.0.1:8004',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
