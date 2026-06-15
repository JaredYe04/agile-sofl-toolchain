#!/usr/bin/env node
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const onigWasm = join(dirname(require.resolve('vscode-oniguruma/package.json')), 'release', 'onig.wasm')
const { formatDocument } = require('@agile-sofl/editor-api')

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

const templatesRoot = join(studioRoot, 'templates')
const examplesRoot = join(studioRoot, '..', '..', 'examples')
const templateOutDirs = [join(studioRoot, 'public', 'templates'), join(studioRoot, 'assets', 'templates')]
const templateFiles = [
  ['blank.asfl', join(templatesRoot, 'blank.asfl')],
  ['minimal-module.asfl', join(templatesRoot, 'minimal-module.asfl')],
  ['library-system.asfl', join(examplesRoot, 'library-system.asfl')],
  ['ecommerce.asfl', join(examplesRoot, 'ecommerce.asfl')],
  ['hospital-registration.asfl', join(examplesRoot, 'hospital-registration.asfl')],
  ['type-showcase.asfl', join(examplesRoot, 'type-showcase.asfl')],
  ['informal-blank.aspec', join(studioRoot, 'assets', 'templates', 'informal-blank.aspec')],
  ['library-informal.aspec', join(studioRoot, 'assets', 'templates', 'library-informal.aspec')],
  ['informal-blank.guispec', join(studioRoot, 'public', 'templates', 'informal-blank.guispec')],
  ['library-gui.guispec', join(examplesRoot, 'library-gui.guispec')],
  ['manifest.json', join(studioRoot, 'assets', 'templates', 'manifest.json')]
]

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

for (const outDir of templateOutDirs) {
  mkdirSync(outDir, { recursive: true })
  for (const [dest, from] of templateFiles) {
    if (!existsSync(from)) {
      console.error(`Missing template source: ${from}`)
      process.exit(1)
    }
    const outPath = join(outDir, dest)
    if (dest.endsWith('.asfl')) {
      const raw = readFileSync(from, 'utf8')
      const formatted = formatDocument(raw).replace(/\r\n/g, '\n').replace(/\n+$/, '') + '\n'
      writeFileSync(outPath, formatted, 'utf8')
    } else {
      copyFileSync(from, outPath)
    }
    console.log(`Copied template ${dest} -> ${outDir.replace(studioRoot, 'packages/studio')}`)
  }
}
