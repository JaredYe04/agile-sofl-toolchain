#!/usr/bin/env node
/**
 * Format Studio new-file templates and example sources used as templates.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { formatDocument } = require('@agile-sofl/editor-api')

const studioRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = join(studioRoot, '..', '..')

const sources = [
  join(studioRoot, 'templates', 'blank.asfl'),
  join(studioRoot, 'templates', 'minimal-module.asfl'),
  join(repoRoot, 'examples', 'library-system.asfl'),
  join(repoRoot, 'examples', 'ecommerce.asfl'),
  join(repoRoot, 'examples', 'hospital-registration.asfl'),
  join(repoRoot, 'examples', 'type-showcase.asfl')
]

function normalizeNewline(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n+$/, '') + '\n'
}

let updated = 0
for (const file of sources) {
  if (!existsSync(file)) {
    console.warn(`Skip missing template source: ${file}`)
    continue
  }
  const before = readFileSync(file, 'utf8')
  const formatted = normalizeNewline(formatDocument(before))
  if (formatted !== normalizeNewline(before)) {
    writeFileSync(file, formatted, 'utf8')
    updated++
    console.log(`Formatted ${file.replace(repoRoot + '/', '').replace(studioRoot + '/', 'studio/')}`)
  }
}

console.log(updated ? `Updated ${updated} template file(s).` : 'All templates already formatted.')
