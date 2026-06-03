import * as esbuild from 'esbuild'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outFile = join(__dirname, '..', 'dist', 'server.js')

mkdirSync(dirname(outFile), { recursive: true })

await esbuild.build({
  entryPoints: [join(__dirname, '..', 'src', 'server.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: outFile,
  external: [],
  format: 'cjs',
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node'
  }
})

console.log('Bundled language server to', outFile)
