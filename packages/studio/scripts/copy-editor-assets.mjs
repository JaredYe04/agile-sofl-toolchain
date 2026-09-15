#!/usr/bin/env node
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync, cpSync } from 'node:fs'
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
  ['graph-showcase.asfl', join(examplesRoot, 'graph-showcase.asfl')],
  ['informal-blank.aspec', join(studioRoot, 'assets', 'templates', 'informal-blank.aspec')],
  ['atm-informal.aspec', join(studioRoot, 'assets', 'templates', 'atm-informal.aspec')],
  ['library-informal.aspec', join(studioRoot, 'assets', 'templates', 'library-informal.aspec')],
  ['minimal-informal.aspec', join(studioRoot, 'assets', 'templates', 'minimal-informal.aspec')],
  ['ecommerce-informal.aspec', join(studioRoot, 'assets', 'templates', 'ecommerce-informal.aspec')],
  ['hospital-informal.aspec', join(studioRoot, 'assets', 'templates', 'hospital-informal.aspec')],
  ['type-showcase-informal.aspec', join(studioRoot, 'assets', 'templates', 'type-showcase-informal.aspec')],
  ['graph-showcase-informal.aspec', join(studioRoot, 'assets', 'templates', 'graph-showcase-informal.aspec')],
  ['minimal-gui-module.asfl', join(templatesRoot, 'minimal-gui-module.asfl')],
  ['library-gui-module.asfl', join(templatesRoot, 'library-gui-module.asfl')],
  ['ecommerce-gui-module.asfl', join(templatesRoot, 'ecommerce-gui-module.asfl')],
  ['hospital-gui-module.asfl', join(templatesRoot, 'hospital-gui-module.asfl')],
  ['type-showcase-gui-module.asfl', join(templatesRoot, 'type-showcase-gui-module.asfl')],
  ['graph-showcase-gui-module.asfl', join(templatesRoot, 'graph-showcase-gui-module.asfl')],
  ['informal-blank.gui.html', join(studioRoot, 'public', 'templates', 'informal-blank.gui.html')],
  ['minimal-gui.gui.html', join(studioRoot, 'assets', 'templates', 'minimal-gui.gui.html')],
  ['library-gui.gui.html', join(studioRoot, 'assets', 'templates', 'library-gui.gui.html')],
  ['ecommerce-gui.gui.html', join(studioRoot, 'assets', 'templates', 'ecommerce-gui.gui.html')],
  ['hospital-gui.gui.html', join(studioRoot, 'assets', 'templates', 'hospital-gui.gui.html')],
  ['type-showcase-gui.gui.html', join(studioRoot, 'assets', 'templates', 'type-showcase-gui.gui.html')],
  ['graph-showcase-gui.gui.html', join(studioRoot, 'assets', 'templates', 'graph-showcase-gui.gui.html')],
  ['project-manifest.json', join(studioRoot, 'assets', 'templates', 'project-manifest.json')]
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
    if (dest.endsWith('.asfl') && !dest.includes('gui-module')) {
      const raw = readFileSync(from, 'utf8')
      const formatted = formatDocument(raw).replace(/\r\n/g, '\n').replace(/\n+$/, '') + '\n'
      writeFileSync(outPath, formatted, 'utf8')
    } else {
      copyFileSync(from, outPath)
    }
    console.log(`Copied template ${dest} -> ${outDir.replace(studioRoot, 'packages/studio')}`)
  }
}

const vditorPkg = dirname(require.resolve('vditor/package.json'))
const vditorDist = join(vditorPkg, 'dist')
for (const dest of [join(studioRoot, 'public', 'vditor', 'dist'), join(studioRoot, 'assets', 'vditor', 'dist')]) {
  mkdirSync(dirname(dest), { recursive: true })
  cpSync(vditorDist, dest, { recursive: true })
  console.log(`Copied vditor dist -> ${dest.replace(studioRoot, 'packages/studio')}`)
}
