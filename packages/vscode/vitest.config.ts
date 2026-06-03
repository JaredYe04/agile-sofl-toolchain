import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@agile-sofl/parser': path.resolve(__dirname, '../parser/src/index.ts')
    },
    extensions: ['.ts', '.js', '.mjs']
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true
  },
  esbuild: {
    target: 'es2020'
  }
})
