#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { check } from '@agile-sofl/parser'
import { parseAspec } from './parse.js'
import { validateAspec } from './validate.js'
import { refineToAsfl, traceToJson } from './refine/refineToAsfl.js'
import { buildCoverageReport, parseTraceJson } from './trace/coverage.js'

function usage(): void {
  console.log(`Usage:
  aspec validate <file.aspec> [--book-align-strict]
  aspec inspect <file.aspec>
  aspec refine <file.aspec> [-o out.asfl] [--check] [--trace out.trace.json] [--preserve-existing existing.asfl]
  aspec coverage <file.aspec> [--asfl hybrid.asfl] [--trace trace.json]`)
}

const args = process.argv.slice(2)
const cmd = args[0]
const file = args[1]

if (!cmd || !file || cmd === '--help') {
  usage()
  process.exit(cmd ? 0 : 1)
}

const source = readFileSync(file, 'utf8')

if (cmd === 'validate' || cmd === 'inspect') {
  const bookStrict = args.includes('--book-align-strict')
  const { document, diagnostics: parseDiags } = parseAspec(source)
  if (!document) {
    for (const d of parseDiags) console.log(`${d.severity.toUpperCase()} ${d.code}: ${d.message}`)
    process.exit(1)
  }
  const styleDiags = validateAspec(document, { bookAlignStrict: bookStrict })
  for (const d of [...parseDiags, ...styleDiags]) {
    console.log(`${d.severity.toUpperCase()} ${d.code}: ${d.message}`)
  }
  process.exit([...parseDiags, ...styleDiags].some((d) => d.severity === 'error') ? 1 : 0)
}

if (cmd === 'refine') {
  const { document } = parseAspec(source)
  if (!document) {
    console.error('Parse failed')
    process.exit(1)
  }
  const styleDiags = validateAspec(document)
  if (styleDiags.some((d) => d.severity === 'error')) {
    for (const d of styleDiags) console.error(`${d.code}: ${d.message}`)
    process.exit(1)
  }
  let outIdx = args.indexOf('-o')
  const outFile = outIdx >= 0 ? args[outIdx + 1] : undefined
  const checkFlag = args.includes('--check')
  let traceIdx = args.indexOf('--trace')
  const traceFile = traceIdx >= 0 ? args[traceIdx + 1] : undefined
  const preserveIdx = args.indexOf('--preserve-existing')
  const existingAsfl = preserveIdx >= 0 ? readFileSync(args[preserveIdx + 1]!, 'utf8') : undefined

  const result = refineToAsfl(document, source, {
    aspecUri: file,
    asflUri: outFile ?? document.meta.hybridTarget,
    emitTraceFile: Boolean(traceFile),
    preserveExisting: Boolean(existingAsfl),
    existingAsfl
  })

  if (outFile) writeFileSync(outFile, result.asflText, 'utf8')
  else console.log(result.asflText)

  if (traceFile) writeFileSync(traceFile, traceToJson(result.traceability), 'utf8')

  for (const w of result.warnings) console.warn(`WARN ${w.code}: ${w.message}`)

  if (checkFlag && outFile) {
    const checkResult = check(result.asflText)
    for (const d of checkResult.diagnostics) {
      console.log(`${d.severity} ${d.code}: ${d.message}`)
    }
    if (checkResult.diagnostics.some((d) => d.severity === 'error')) process.exit(1)
  }
  process.exit(0)
}

if (cmd === 'coverage') {
  let asflFile = args.includes('--asfl') ? args[args.indexOf('--asfl') + 1] : undefined
  let traceFile = args.includes('--trace') ? args[args.indexOf('--trace') + 1] : undefined
  const asflSource = asflFile ? readFileSync(asflFile, 'utf8') : ''
  const trace = traceFile ? parseTraceJson(readFileSync(traceFile, 'utf8')) : null
  const report = buildCoverageReport(source, asflSource, trace)
  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
}

usage()
process.exit(1)
