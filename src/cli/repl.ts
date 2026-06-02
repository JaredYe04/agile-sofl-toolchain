/**
 * Interactive REPL for Agile-SOFL specifications.
 */

import * as readline from 'node:readline'
import { inspect, type InspectOptions } from './report.js'
import { format } from '../index.js'
import { color, ansi } from './ansi.js'

const HELP = `
${color('Agile-SOFL REPL', ansi.bold)} — enter specification lines, then run a command.

Input modes:
  • Type spec lines; end with a blank line or :end
  • One-liner: :check module SYSTEM_T; var x: nat; end_module

Commands:
  :check   Full parse + semantics report (default)
  :tree    Report with AST summary tree
  :tokens  Report with token stream
  :format  Pretty-print current buffer
  :clear   Clear buffer
  :help    Show this help
  :quit    Exit (also :q, Ctrl+C)
`

export async function runRepl(): Promise<void> {
  return new Promise((resolve) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: color('asfl> ', ansi.cyan)
  })

  let buffer: string[] = []
  let inspectOpts: InspectOptions = {}

  console.log(HELP)

  const runInspect = (source: string, opts: InspectOptions) => {
    if (!source.trim()) {
      console.log(color('(empty input)', ansi.dim))
      return
    }
    const report = inspect(source, opts)
    console.log(report.text)
  }

  rl.prompt()

  rl.on('line', (line) => {
    const trimmed = line.trim()

    if (trimmed === ':quit' || trimmed === ':q') {
      rl.close()
      return
    }

    if (trimmed === ':help') {
      console.log(HELP)
      rl.prompt()
      return
    }

    if (trimmed === ':clear') {
      buffer = []
      inspectOpts = {}
      console.log(color('Buffer cleared.', ansi.dim))
      rl.prompt()
      return
    }

    if (trimmed === ':end') {
      runInspect(buffer.join('\n'), inspectOpts)
      rl.prompt()
      return
    }

    if (trimmed.startsWith(':')) {
      const [cmd, ...rest] = trimmed.split(/\s+/)
      const inline = rest.join(' ').trim()

      switch (cmd) {
        case ':check':
          inspectOpts = {}
          if (inline) runInspect(inline, inspectOpts)
          else if (buffer.length) runInspect(buffer.join('\n'), inspectOpts)
          else console.log(color('No input. Type spec lines or :check <one-liner>', ansi.yellow))
          break
        case ':tree':
          inspectOpts = { tree: true }
          if (inline) runInspect(inline, inspectOpts)
          else if (buffer.length) runInspect(buffer.join('\n'), inspectOpts)
          else console.log(color('No input.', ansi.yellow))
          break
        case ':tokens':
          inspectOpts = { tokens: true }
          if (inline) runInspect(inline, inspectOpts)
          else if (buffer.length) runInspect(buffer.join('\n'), inspectOpts)
          else console.log(color('No input.', ansi.yellow))
          break
        case ':format': {
          const src = inline || buffer.join('\n')
          if (!src.trim()) {
            console.log(color('No input.', ansi.yellow))
            break
          }
          const { source: out, diagnostics } = format(src)
          for (const d of diagnostics.filter((x) => x.severity === 'error')) {
            console.error(d.message)
          }
          console.log(out)
          break
        }
        default:
          console.log(color(`Unknown command: ${cmd}. Type :help`, ansi.yellow))
      }
      rl.prompt()
      return
    }

    if (trimmed === '' && buffer.length > 0) {
      runInspect(buffer.join('\n'), inspectOpts)
      buffer = []
      inspectOpts = {}
      rl.prompt()
      return
    }

    if (trimmed !== '') {
      buffer.push(line)
    }
    rl.prompt()
  })

  rl.on('close', () => {
    console.log(color('Bye.', ansi.dim))
    resolve()
  })
  })
}
