import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'include-license-files',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'LICENSE', source: readFileSync('LICENSE', 'utf8') })
      }
    }
  ],
  base: './',
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true
  }
})
