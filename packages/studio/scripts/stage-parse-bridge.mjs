#!/usr/bin/env node
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const studioRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(studioRoot, 'dist', 'parse-bridge.cjs')
const destDir = join(studioRoot, 'out', 'dist')
const dest = join(destDir, 'parse-bridge.cjs')

if (!existsSync(src)) {
  console.error('Missing dist/parse-bridge.cjs — run bundle:parse-bridge first')
  process.exit(1)
}

mkdirSync(destDir, { recursive: true })
copyFileSync(src, dest)
console.log('Staged parse-bridge.cjs -> out/dist/parse-bridge.cjs')
