import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const lspDist = join(__dirname, '..', '..', 'language-server', 'dist', 'server.js')
const lspMap = join(__dirname, '..', '..', 'language-server', 'dist', 'server.js.map')
const outDir = join(__dirname, '..', 'server')
const outFile = join(outDir, 'server.js')
const outMap = join(outDir, 'server.js.map')

mkdirSync(outDir, { recursive: true })
copyFileSync(lspDist, outFile)
try {
  copyFileSync(lspMap, outMap)
} catch {
  // source map optional
}

console.log('Copied language server bundle to', outFile)
