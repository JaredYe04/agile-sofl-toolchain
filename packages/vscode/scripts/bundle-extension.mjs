import * as esbuild from 'esbuild'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'dist')
const outFile = join(outDir, 'extension.js')

mkdirSync(outDir, { recursive: true })

await esbuild.build({
  entryPoints: [join(__dirname, '..', 'src', 'extension.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: outFile,
  external: ['vscode'],
  format: 'cjs',
  sourcemap: true
})

console.log('Bundled extension to', outFile)
