import * as esbuild from 'esbuild'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'dist')
const outFile = join(outDir, 'demo.js')

mkdirSync(outDir, { recursive: true })

await esbuild.build({
  entryPoints: [join(__dirname, '..', 'src', 'main.ts')],
  bundle: true,
  platform: 'browser',
  target: 'es2020',
  outfile: outFile,
  format: 'iife',
  globalName: 'AgileSoflDemo',
  sourcemap: true
})

console.log('Bundled demo to', outFile)
