import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { loadEnv } from 'vite'
import process from 'node:process'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiUrl = (env.VITE_API_URL || 'https://hidro-app.onrender.com')
    .trim()
    .replace(/\/+$/, '')
  const apiTarget = apiUrl.endsWith('/api') ? apiUrl.slice(0, -4) : apiUrl

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  }
})
