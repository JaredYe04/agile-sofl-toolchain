#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  highlightSource,
  annotateLine,
  ansiLine
} from './highlight-lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const scopeMap = JSON.parse(readFileSync(join(__dirname, 'highlight-scope-map.json'), 'utf-8'))

const args = process.argv.slice(2)
const writeSnapshots = args.includes('--write-snapshots')
const useAnsi = args.includes('--ansi')
const files = args.filter((a) => !a.startsWith('--'))

if (files.length === 0) {
  console.error('Usage: node scripts/highlight-report.mjs [--ansi] [--write-snapshots] <file.asfl> [...]')
  process.exit(1)
}

for (const file of files) {
  const source = readFileSync(file, 'utf-8')
  const highlighted = await highlightSource(source)
  console.log(`\n=== ${file} ===`)
  for (const row of highlighted) {
    if (!row.text.trim()) continue
    const rendered = useAnsi ? ansiLine(row.segments, scopeMap) : annotateLine(row.segments)
    console.log(`${String(row.line).padStart(4)} | ${rendered}`)
  }

  if (writeSnapshots) {
    const snapPath = join(dirname(file), basename(file, '.asfl') + '.highlight.json')
    writeFileSync(snapPath, JSON.stringify({ file: basename(file), lines: highlighted }, null, 2))
    console.log(`Wrote ${snapPath}`)
  }
}
