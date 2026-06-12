#!/usr/bin/env node
/**
 * Sync syntax-palettes.json into package.json tokenColorCustomizations (light/dark).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const palettes = JSON.parse(readFileSync(join(root, 'syntax-palettes.json'), 'utf8'))
const pkgPath = join(root, '..', 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

function toTextMateRules(rules) {
  return rules.map((r) => ({
    scope: r.token,
    settings: {
      foreground: `#${r.foreground}`,
      ...(r.fontStyle ? { fontStyle: r.fontStyle } : {})
    }
  }))
}

const agileDefaults = pkg.contributes.configurationDefaults['[agile-sofl]'] ?? {}

agileDefaults['editor.tokenColorCustomizations'] = {
  '[*Light*]': { textMateRules: toTextMateRules(palettes.light.rules) },
  '[*Dark*]': { textMateRules: toTextMateRules(palettes.dark.rules) },
  '[*]': { textMateRules: toTextMateRules(palettes.dark.rules) }
}

agileDefaults['editor.semanticTokenColorCustomizations'] = {
  '[*Light*]': palettes.light.semantic,
  '[*Dark*]': palettes.dark.semantic,
  '[*]': palettes.dark.semantic
}

pkg.contributes.configurationDefaults['[agile-sofl]'] = agileDefaults
delete pkg.contributes.tokenColors

writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
console.log('Synced token colors from syntax-palettes.json -> package.json')
