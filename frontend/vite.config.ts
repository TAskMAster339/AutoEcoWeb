import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Dev proxy: backend API.
      // Host dev (npm run dev): backend is published on localhost:80.
      // Container dev (docker compose): backend must be reached by its compose
      // service name — set VITE_PROXY_TARGET=http://backend:80 there.
      // Keeps requests same-origin in dev, so SameSite=Lax auth cookies work.
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:80',
        changeOrigin: true,
      },
    },
  },
})
