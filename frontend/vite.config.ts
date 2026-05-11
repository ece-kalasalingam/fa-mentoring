import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
function readDevVarsGoogleClientId(): string {
  const devVarsPath = path.resolve(__dirname, '../api/.dev.vars')
  if (!fs.existsSync(devVarsPath)) {
    return ''
  }
  const raw = fs.readFileSync(devVarsPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex <= 0) {
      continue
    }
    const key = trimmed.slice(0, eqIndex).trim()
    if (key !== 'GOOGLE_CLIENT_ID') {
      continue
    }
    const value = trimmed.slice(eqIndex + 1).trim()
    return value.replace(/^['"]|['"]$/g, '')
  }
  return ''
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const fallbackGoogleClientId = readDevVarsGoogleClientId()
  const viteGoogleClientId = (env.VITE_GOOGLE_CLIENT_ID || fallbackGoogleClientId).trim()

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(viteGoogleClientId)
    },
    build: {
      chunkSizeWarningLimit: 1800,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('@mui/x-data-grid')) return 'mui-datagrid'
            if (id.includes('@mui/material') || id.includes('@mui/icons-material') || id.includes('@emotion')) return 'mui-core'
            if (id.includes('react') || id.includes('react-dom')) return 'react-vendor'
            return 'vendor'
          }
        }
      }
    }
  }
})
