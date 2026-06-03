#!/usr/bin/env node
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const onigWasm = join(dirname(require.resolve('vscode-oniguruma/package.json')), 'release', 'onig.wasm')

const studioRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const vscodeRoot = join(studioRoot, '..', 'vscode')
const outDirs = [
  join(studioRoot, 'assets', 'syntax'),
  join(studioRoot, 'public', 'syntax')
]

const files = [
  ['syntaxes/agile-sofl.tmLanguage.json', 'agile-sofl.tmLanguage.json'],
  ['language-configuration.json', 'language-configuration.json'],
  ['scripts/highlight-scope-map.json', 'highlight-scope-map.json']
]

const extraFiles = [[onigWasm, 'onig.wasm']]

for (const outDir of outDirs) {
  mkdirSync(outDir, { recursive: true })
  for (const [src, dest] of files) {
    const from = join(vscodeRoot, src)
    const to = join(outDir, dest)
    if (!existsSync(from)) {
      console.error(`Missing source asset: ${from}`)
      process.exit(1)
    }
    copyFileSync(from, to)
    console.log(`Copied ${src} -> ${to.replace(studioRoot, 'packages/studio')}`)
  }
  for (const [src, dest] of extraFiles) {
    copyFileSync(src, join(outDir, dest))
  }
}
