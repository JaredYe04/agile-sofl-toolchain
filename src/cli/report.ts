/**
 * Human-readable inspect reports for Agile-SOFL specifications.
 */

import type {
  ProgramNode,
  ModuleNode,
  PredicateNode,
  AtomicPredicateNode,
  ExpressionNode
} from '../ast/nodes.js'
import { textOf } from '../ast/nodes.js'
import type { Diagnostic } from '../diagnostics/codes.js'
import { formatDiagnostic } from '../diagnostics/codes.js'
import { parse } from '../parser/parse.js'
import { resolveScope } from '../scope/resolver.js'
import { typeCheck } from '../typecheck/checker.js'
import { classifyFsf } from '../fsf/classifier.js'
import { tokenize } from '../lexer/lexer.js'
import { ansi, color } from './ansi.js'

export interface InspectOptions {
  /** Show token stream table */
  tokens?: boolean
  /** Show indented AST summary tree */
  tree?: boolean
  /** Emit full AST as JSON instead of summary */
  fullJson?: boolean
  /** Max tree depth (default 4) */
  treeDepth?: number
  /** Use ANSI colors (default true when TTY) */
  colors?: boolean
}

export interface InspectReport {
  source: string
  ast: ProgramNode | null
  diagnostics: Diagnostic[]
  text: string
  exitCode: number
}

function summarizePredicate(pred: PredicateNode, maxLen = 48): string {
  const parts: string[] = []
  for (const conj of pred.disjuncts) {
    for (const atom of conj.atoms) {
      parts.push(summarizeAtom(atom))
    }
  }
  const s = parts.join(' or ')
  return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s
}

function summarizeAtom(atom: AtomicPredicateNode): string {
  switch (atom.type) {
    case 'informal_text':
      return `"${atom.text}"`
    case 'boolean_literal':
      return atom.value ? 'true' : 'false'
    case 'relational_expr':
      return `${exprBrief(atom.left)} ${atom.kind} ${exprBrief(atom.right)}`
    case 'quantified':
      return `${atom.quantifier}[…] | …`
    case 'not_predicate':
      return `not (…)`
    case 'paren_predicate':
      return `(…)`
    default:
      return exprBrief(atom)
  }
}

function exprBrief(expr: ExpressionNode): string {
  switch (expr.type) {
    case 'identifier':
      return expr.name
    case 'number_literal':
      return String(expr.value)
    case 'binary_op':
      return `${exprBrief(expr.left)} ${expr.op} ${exprBrief(expr.right)}`
    case 'boolean_literal':
      return expr.value ? 'true' : 'false'
    case 'nil':
      return 'nil'
    default:
      return expr.type
  }
}

function countDiagnostics(diagnostics: Diagnostic[]) {
  return {
    errors: diagnostics.filter((d) => d.severity === 'error').length,
    warnings: diagnostics.filter((d) => d.severity === 'warning').length,
    infos: diagnostics.filter((d) => d.severity === 'info').length
  }
}

function boxLine(content: string, width = 42): string {
  const inner = content.length > width - 4 ? content.slice(0, width - 5) + '…' : content
  const pad = Math.max(0, width - 4 - inner.length)
  return `│ ${inner}${' '.repeat(pad)} │`
}

function renderHeader(ast: ProgramNode | null, diagnostics: Diagnostic[]): string[] {
  const lines: string[] = []
  const w = 44
  const { errors, warnings, infos } = countDiagnostics(diagnostics)
  let modules = 0
  let processes = 0
  let functions = 0
  if (ast) {
    modules = ast.modules.length
    for (const m of ast.modules) {
      processes += m.processes.length
      functions += m.functions.length
    }
  }
  const parseOk = errors === 0 || ast !== null
  const status = parseOk
    ? color('✓ parse', ansi.green)
    : color('✗ parse', ansi.red)
  const warnStr = warnings > 0 ? color(`⚠ ${warnings} warning(s)`, ansi.yellow) : color('⚠ 0 warnings', ansi.dim)
  const errStr = errors > 0 ? color(`✗ ${errors} error(s)`, ansi.red) : color('✗ 0 errors', ansi.dim)
  const infoStr = infos > 0 ? color(`ℹ ${infos} info`, ansi.cyan) : ''

  lines.push(`┌─ ${color('Agile-SOFL Inspect', ansi.bold)}${'─'.repeat(w - 20)}┐`)
  lines.push(boxLine(`Modules: ${modules}  Processes: ${processes}  Functions: ${functions}`, w))
  lines.push(boxLine(`${status}  ${warnStr}  ${errStr}${infoStr ? '  ' + infoStr : ''}`, w + 20))
  lines.push(`└${'─'.repeat(w - 2)}┘`)
  return lines
}

function renderModule(mod: ModuleNode): string[] {
  const lines: string[] = []
  const prefix = mod.isSystem ? 'SYSTEM_' : ''
  lines.push('')
  lines.push(color(`Module ${prefix}${mod.name}`, ansi.bold + ansi.blue))
  if (mod.parent) {
    lines.push(`  ${ansi.dim}parent:${ansi.reset} ${mod.parent.name}`)
  }
  if (mod.consts.length) {
    lines.push(`  const: ${mod.consts.map((c) => c.name).join(', ')}`)
  }
  if (mod.types.length) {
    lines.push(`  type:  ${mod.types.map((t) => t.name).join(', ')}`)
  }
  if (mod.vars.length) {
    lines.push(`  var:   ${mod.vars.map((v) => v.variable.name).join(', ')}`)
  }
  if (mod.invariants.length) {
    lines.push(`  inv:   ${mod.invariants.length} predicate(s)`)
  }
  for (const proc of mod.processes) {
    lines.push(`  ${color('process', ansi.cyan)} ${proc.name}${proc.isInit ? ' (Init)' : ''}`)
    if (proc.body?.ext.length) {
      lines.push(`    ext: ${proc.body.ext.map((e) => `${e.access} ${e.name}`).join(', ')}`)
    }
    if (proc.body?.fsf) {
      lines.push(`    FSF scenarios:`)
      proc.body.fsf.scenarios.forEach((sc, i) => {
        lines.push(`      [${i + 1}] ${summarizePredicate(sc.test)}  =>  ${summarizePredicate(sc.def)}`)
      })
      if (proc.body.fsf.others) {
        lines.push(`      ${color('others', ansi.yellow)}     =>  ${summarizePredicate(proc.body.fsf.others)}`)
      }
    }
    const decom = textOf(proc.body?.decomposition)
    if (decom) {
      lines.push(`    decom: ${decom}`)
    }
    const comment = textOf(proc.body?.comment)
    if (comment) {
      lines.push(`    comment: ${comment}`)
    }
  }
  for (const fn of mod.functions) {
    lines.push(`  ${color('function', ansi.cyan)} ${fn.name}`)
  }
  return lines
}

function renderDiagnostics(diagnostics: Diagnostic[], source: string): string[] {
  if (diagnostics.length === 0) return [color('\nNo diagnostics.', ansi.dim)]
  const lines: string[] = ['', color('Diagnostics', ansi.bold)]
  for (const d of diagnostics) {
    const sevColor = d.severity === 'error' ? ansi.red : d.severity === 'warning' ? ansi.yellow : ansi.cyan
    lines.push(color(`  [${d.severity}] ${d.code} @ ${d.span.line}:${d.span.column}`, sevColor))
    lines.push(`  ${d.message}`)
    const ctx = formatDiagnostic(d, source).split('\n').slice(1)
    for (const c of ctx) {
      if (c.trim()) lines.push(color(`  ${c}`, ansi.dim))
    }
  }
  return lines
}

function renderTokenTable(source: string): string[] {
  const result = tokenize(source)
  const lines: string[] = ['', color('Token stream', ansi.bold)]
  lines.push(`${'Type'.padEnd(16)} ${'Image'.padEnd(24)} Loc`)
  lines.push('─'.repeat(52))
  for (const t of result.tokens) {
    const img = t.image.length > 22 ? t.image.slice(0, 20) + '…' : t.image
    lines.push(
      `${t.tokenType.name.padEnd(16)} ${img.padEnd(24)} ${t.startLine}:${t.startColumn}`
    )
  }
  if (result.errors.length) {
    lines.push(color(`Lex errors: ${result.errors.length}`, ansi.red))
  }
  return lines
}

function renderTree(ast: ProgramNode | null, depth: number, maxDepth: number, indent = 0): string[] {
  if (!ast || depth > maxDepth) return []
  const pad = '  '.repeat(indent)
  const lines: string[] = []
  lines.push(`${pad}${color('program', ansi.bold)} (${ast.modules.length} modules)`)
  for (const mod of ast.modules) {
    lines.push(`${pad}  ${color('module', ansi.blue)} ${mod.isSystem ? 'SYSTEM_' : ''}${mod.name}`)
    lines.push(`${pad}    consts: ${mod.consts.length}  types: ${mod.types.length}  vars: ${mod.vars.length}`)
    lines.push(`${pad}    processes: ${mod.processes.length}  functions: ${mod.functions.length}`)
    if (depth + 1 <= maxDepth) {
      for (const p of mod.processes) {
        lines.push(`${pad}    ${color('process', ansi.cyan)} ${p.name}`)
        if (p.body?.fsf) {
          lines.push(`${pad}      fsf: ${p.body.fsf.scenarios.length} scenario(s)${p.body.fsf.others ? ' + others' : ''}`)
        }
      }
    }
  }
  return lines
}

/** Build a full inspect report for source text. */
export function inspect(source: string, options: InspectOptions = {}): InspectReport {
  const parseResult = parse(source)
  const diagnostics: Diagnostic[] = [...parseResult.diagnostics]
  let ast: ProgramNode | null =
    parseResult.ast && parseResult.ast.type === 'program' ? parseResult.ast : null

  if (ast && !diagnostics.some((d) => d.severity === 'error')) {
    diagnostics.push(
      ...resolveScope(ast).diagnostics,
      ...typeCheck(ast).diagnostics,
      ...classifyFsf(ast).diagnostics
    )
  }
  const maxDepth = options.treeDepth ?? 4
  const lines: string[] = []

  if (options.fullJson && ast) {
    lines.push(JSON.stringify(ast, null, 2))
  } else {
    lines.push(...renderHeader(ast, diagnostics))
    if (ast) {
      for (const mod of ast.modules) {
        lines.push(...renderModule(mod))
      }
    }
    if (options.tree) {
      lines.push(...renderTree(ast, 0, maxDepth))
    }
    if (options.tokens) {
      lines.push(...renderTokenTable(source))
    }
    lines.push(...renderDiagnostics(diagnostics, source))
  }

  const exitCode = diagnostics.some((d) => d.severity === 'error') ? 1 : 0
  return { source, ast, diagnostics, text: lines.join('\n'), exitCode }
}

/** Format inspect report as terminal string. */
export function formatInspectReport(report: InspectReport): string {
  return report.text
}
