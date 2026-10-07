#!/usr/bin/env node
/**
 * CLI for Agile-SOFL parser: inspect, check, parse, format, repl
 */

import { readFileSync } from 'node:fs'
const tStart = Date.now()
import { parseSpecification, format, formatDiagnostic, checkFsfL2 } from './index.js'
import { getZ3Timing } from './fsf/l2Check.js'
import { parse } from './parser/parse.js'
import { inspect } from './cli/report.js'
import { runRepl } from './cli/repl.js'

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    process.stdin.on('data', (c) => chunks.push(c as Buffer))
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    process.stdin.on('error', reject)
  })
}

function parseFlags(args: string[]) {
  const flags = new Set<string>()
  const positional: string[] = []
  for (const a of args) {
    if (a.startsWith('--')) flags.add(a)
    else positional.push(a)
  }
  return {
    positional,
    json: flags.has('--json'),
    tree: flags.has('--tree'),
    tokens: flags.has('--tokens'),
    full: flags.has('--full'),
    noL1: flags.has('--no-l1'),
    noL2: flags.has('--no-l2'),
    timings: flags.has('--timings')
  }
}

async function readSource(file: string | undefined): Promise<string> {
  if (file) return readFileSync(file, 'utf-8')
  if (!process.stdin.isTTY) return readStdin()
  return ''
}

function printHelp(): void {
  console.log(`Agile-SOFL parser CLI

Usage:
  asfl inspect [file.asfl]     Human-readable report (stdin if no file)
  asfl check [file.asfl]       Same as inspect
  asfl parse [file.asfl]       Parse (--json for raw AST)
  asfl format [file.asfl]      Pretty-print specification
  asfl repl                    Interactive REPL

Inspect flags:
  --tree     Include AST summary tree
  --tokens   Include lexer token table
  --full     Full AST JSON (with inspect)
  --json     Raw JSON output (with parse)
  --no-l1    Skip the L1 FSF static check (inspect/check)
  --no-l2    Skip the L2 Z3 FSF check (inspect/check)
  --timings  Print phase timings (module load, parse+L1, Z3 load, L2, report) to stderr

Examples:
  asfl inspect tests/fixtures/integration/banking.asfl
  asfl inspect --tree --tokens myspec.asfl
  echo "module SYSTEM_T; end_module" | asfl inspect
  asfl repl
`)
}

const tLoad0 = Number(process.env.ASFL_T0) || (Date.now() - Math.round(process.uptime() * 1000))
const tMain = Date.now()
void tStart

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2)
  if (rawArgs.length === 0 || rawArgs[0] === 'help' || rawArgs[0] === '--help') {
    printHelp()
    process.exit(0)
  }

  const command = rawArgs[0]
  const { positional, json, tree, tokens, full, noL1, noL2, timings } = parseFlags(rawArgs.slice(1))
  const file = positional[0]

  if (command === 'repl') {
    await runRepl()
    return
  }

  const source = await readSource(file)

  if (!source.trim() && command !== 'help') {
    console.error(`Usage: asfl ${command} [file.asfl]  (or pipe stdin)`)
    process.exit(1)
  }

  switch (command) {
    case 'inspect':
    case 'check': {
      // L2 (Z3) is asynchronous; run it on the parsed AST and merge into the report.
      let extraDiagnostics: import('./diagnostics/codes.js').Diagnostic[] = []
      const ph: Record<string, number> = { moduleLoadMs: tMain - tLoad0 }
      let t = Date.now()
      if (!noL2) {
        // Same (error-recovering) parser instance as the report below, so only one Chevrotain parser is
        // built per CLI run (~2 s saved). L2 runs only on a syntactically clean AST, as before.
        const parsed = parse(source)
        const clean = !parsed.diagnostics.some((d) => d.severity === 'error' && /^ASFL_(PARSE|LEX)/.test(d.code))
        ph.parseMs = Date.now() - t
        t = Date.now()
        if (parsed.ast?.type === 'program' && clean) extraDiagnostics = (await checkFsfL2(parsed.ast)).diagnostics
        const z = getZ3Timing()
        ph.l2TotalMs = Date.now() - t
        ph.z3ImportMs = z.importMs ?? 0
        ph.z3InitMs = z.initMs ?? 0
        ph.l2SolveMs = ph.l2TotalMs - ph.z3ImportMs - ph.z3InitMs
      }
      t = Date.now()
      const report = inspect(source, { tree, tokens, fullJson: full, fsfL1: !noL1, extraDiagnostics })
      ph.reportMs = Date.now() - t
      ph.totalMs = Date.now() - tLoad0
      console.log(report.text)
      if (timings) console.error('[timings] ' + JSON.stringify(ph))
      process.exit(report.exitCode)
      break
    }
    case 'parse': {
      const { ast, diagnostics } = parseSpecification(source)
      if (!json && !full) {
        const report = inspect(source, { tree: true })
        console.log(report.text)
      } else if (ast) {
        console.log(JSON.stringify(ast, null, 2))
      }
      for (const d of diagnostics) {
        if (json || full) console.error(formatDiagnostic(d, source))
      }
      process.exit(diagnostics.some((d) => d.severity === 'error') ? 1 : 0)
      break
    }
    case 'format': {
      const { source: out, diagnostics } = format(source)
      for (const d of diagnostics.filter((d) => d.severity === 'error')) {
        console.error(formatDiagnostic(d, source))
      }
      console.log(out)
      process.exit(diagnostics.some((d) => d.severity === 'error') ? 1 : 0)
      break
    }
    default:
      printHelp()
      process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
