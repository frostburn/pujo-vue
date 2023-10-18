import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const commitHash = require('child_process')
  .execSync('git rev-parse --short HEAD')
  .toString()
  .trim();

const wsUrl = process.env.PUJO_WS_URL || 'wss://pujo.lumipakkanen.com/ws/'

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    '__COMMIT_HASH__': JSON.stringify(commitHash),
    '__WS_URL__': JSON.stringify(wsUrl),
  },
  plugins: [
    vue(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
