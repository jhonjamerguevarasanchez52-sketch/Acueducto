import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, 'VITE_')
  const apiUrl = (env.VITE_API_URL || 'https://hidro-app.onrender.com')
    .trim()
    .replace(/\/+$/, '')
  const apiTarget = apiUrl.endsWith('/api') ? apiUrl.slice(0, -4) : apiUrl

  return {
    plugins: [react()],
    optimizeDeps: {
      include: ['exceljs'],
    },
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
