/**
 * Semantic token builder for LSP and tests.
 */

import { parse, walk } from '@agile-sofl/parser'
import type {
  ProgramNode,
  AtomicPredicateNode,
  PredicateNode,
  ProcessNode,
  ModuleNode,
  Span,
  InformalTextNode
} from '@agile-sofl/parser'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { SemanticTokens, SemanticTokensBuilder } from 'vscode-languageserver/node.js'

export const SEMANTIC_TOKEN_TYPES = [
  'namespace',
  'function',
  'method',
  'type',
  'parameter',
  'variable',
  'string',
  'keyword'
] as const

export const SEMANTIC_TOKEN_MODIFIERS = ['declaration', 'readonly'] as const

export type SemanticTokenTypeName = (typeof SEMANTIC_TOKEN_TYPES)[number]

export interface SemanticTokenRecord {
  start: number
  length: number
  type: SemanticTokenTypeName
  modifiers?: string[]
  text?: string
}

const TYPE_INDEX: Record<SemanticTokenTypeName, number> = {
  namespace: 0,
  function: 1,
  method: 2,
  type: 3,
  parameter: 4,
  variable: 5,
  string: 6,
  keyword: 7
}

function moduleSlice(source: string, mod: ModuleNode): Span {
  const header = mod.isSystem ? `module SYSTEM_${mod.name}` : `module ${mod.name}`
  const start = source.indexOf(header)
  if (start < 0) return mod.span
  const endIdx = source.indexOf('end_module', start)
  const end = endIdx >= 0 ? endIdx + 'end_module'.length : source.length
  return { start, end, line: mod.span.line, column: mod.span.column }
}

function processSlice(source: string, proc: ProcessNode): Span {
  const header = proc.isInit ? 'process Init' : `process ${proc.name}`
  const start = source.indexOf(header)
  if (start < 0) return proc.span
  const endIdx = source.indexOf('end_process', start)
  const end = endIdx >= 0 ? endIdx + 'end_process'.length : source.length
  return { start, end, line: proc.span.line, column: proc.span.column }
}

function indexOfWord(text: string, name: string): number {
  const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
  const match = re.exec(text)
  return match ? match.index : -1
}

function pushNameInSpan(
  records: SemanticTokenRecord[],
  source: string,
  span: Span,
  name: string,
  type: SemanticTokenTypeName,
  modifiers?: string[]
): void {
  const slice = source.slice(span.start, span.end)
  const idx = indexOfWord(slice, name)
  if (idx < 0) return
  records.push({
    start: span.start + idx,
    length: name.length,
    type,
    modifiers,
    text: name
  })
}

function walkAtom(atom: AtomicPredicateNode, visit: (node: AtomicPredicateNode) => void): void {
  if (atom.type === 'informal_text') {
    visit(atom)
    return
  }
  if (atom.type === 'not_predicate') {
    walkAtom(atom.operand, visit)
    return
  }
  if (atom.type === 'paren_predicate') {
    walkAtom(atom.inner, visit)
    return
  }
  if (atom.type === 'quantified') {
    walkPredicate(atom.body, visit)
    for (const nested of atom.nestedQuantifiers) {
      walkPredicate(nested.body, visit)
    }
  }
}

function pushInformalAtom(
  records: SemanticTokenRecord[],
  source: string,
  containerStart: number,
  containerEnd: number,
  atom: AtomicPredicateNode
): void {
  if (atom.type !== 'informal_text') return
  const informal = atom as InformalTextNode
  if (!informal.text) return
  if (informal.span.end > informal.span.start) {
    records.push({
      start: informal.span.start,
      length: informal.span.end - informal.span.start,
      type: 'string',
      text: informal.text
    })
    return
  }
  const slice = source.slice(containerStart, containerEnd)
  const idx = slice.indexOf(informal.text)
  if (idx >= 0) {
    records.push({
      start: containerStart + idx,
      length: informal.text.length,
      type: 'string',
      text: informal.text
    })
  }
}

function walkPredicate(pred: PredicateNode, visit: (node: AtomicPredicateNode) => void): void {
  for (const conj of pred.disjuncts) {
    for (const atom of conj.atoms) {
      walkAtom(atom, visit)
    }
  }
}

function collectProcessTokens(proc: ProcessNode, source: string, records: SemanticTokenRecord[]): void {
  const procSpan = processSlice(source, proc)
  pushNameInSpan(records, source, procSpan, proc.name, 'method', ['declaration'])
  if (proc.body?.fsf) {
    const fsfSpan = proc.body.fsf.span.end > proc.body.fsf.span.start
      ? proc.body.fsf.span
      : procSpan
    for (const scenario of proc.body.fsf.scenarios) {
      walkPredicate(scenario.test, (atom) => {
        pushInformalAtom(records, source, fsfSpan.start, fsfSpan.end, atom)
      })
      walkPredicate(scenario.def, (atom) => {
        pushInformalAtom(records, source, fsfSpan.start, fsfSpan.end, atom)
      })
    }
    if (proc.body.fsf.others) {
      walkPredicate(proc.body.fsf.others, (atom) => {
        pushInformalAtom(records, source, fsfSpan.start, fsfSpan.end, atom)
      })
    }
  }
  if (proc.body?.comment) {
    const comment = proc.body.comment
    const informalIdx = comment.indexOf('informal')
    if (informalIdx >= 0) {
      const base = source.indexOf(comment, procSpan.start)
      if (base >= 0) {
        records.push({
          start: base + informalIdx,
          length: 'informal'.length,
          type: 'keyword',
          text: 'informal'
        })
      }
    }
  }
  for (const ext of proc.body?.ext ?? []) {
    pushNameInSpan(records, source, ext.span, ext.name, 'parameter', ['readonly'])
  }
}

function collectModuleTokens(mod: ModuleNode, source: string, records: SemanticTokenRecord[]): void {
  const modSpan = moduleSlice(source, mod)
  if (mod.isSystem) {
    const sysIdx = source.indexOf('SYSTEM_', modSpan.start)
    if (sysIdx >= 0) {
      records.push({
        start: sysIdx,
        length: 7,
        type: 'keyword',
        text: 'SYSTEM_'
      })
      records.push({
        start: sysIdx + 7,
        length: mod.name.length,
        type: 'namespace',
        modifiers: ['declaration'],
        text: mod.name
      })
    }
  } else {
    pushNameInSpan(records, source, modSpan, mod.name, 'namespace', ['declaration'])
  }

  for (const t of mod.types) {
    pushNameInSpan(records, source, modSpan, t.name, 'type', ['declaration'])
  }
  for (const v of mod.vars) {
    pushNameInSpan(records, source, modSpan, v.variable.name, 'variable', ['declaration'])
  }
  for (const c of mod.consts) {
    pushNameInSpan(records, source, modSpan, c.name, 'variable', ['declaration'])
  }
  for (const p of mod.processes) {
    collectProcessTokens(p, source, records)
  }
  for (const f of mod.functions) {
    const fnHeader = `function ${f.name}`
    const fnStart = source.indexOf(fnHeader, modSpan.start)
    const fnEnd = source.indexOf('end_function', fnStart)
    const fnSpan: Span = fnStart >= 0
      ? { start: fnStart, end: fnEnd >= 0 ? fnEnd + 'end_function'.length : modSpan.end, line: 1, column: 1 }
      : modSpan
    pushNameInSpan(records, source, fnSpan, f.name, 'function', ['declaration'])
    if (f.fsf) {
      const fsfSpan = f.fsf.span
      for (const scenario of f.fsf.scenarios) {
        walkPredicate(scenario.test, (atom) => {
          pushInformalAtom(records, source, fsfSpan.start, fsfSpan.end, atom)
        })
      }
    }
  }
}

export function buildSemanticTokenRecords(source: string, ast?: ProgramNode | null): SemanticTokenRecord[] {
  const parsed = ast ?? parse(source).ast
  if (!parsed || parsed.type !== 'program') return []

  const records: SemanticTokenRecord[] = []
  walk(parsed, {
    enterModule(mod) {
      collectModuleTokens(mod, source, records)
    }
  })
  return dedupeRecords(records)
}

function dedupeRecords(records: SemanticTokenRecord[]): SemanticTokenRecord[] {
  const seen = new Set<string>()
  return records
    .filter((r) => r.length > 0)
    .sort((a, b) => a.start - b.start || a.length - b.length)
    .filter((r) => {
      const key = `${r.start}:${r.length}:${r.type}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function modifierBits(modifiers?: string[]): number {
  let bits = 0
  for (const mod of modifiers ?? []) {
    const idx = SEMANTIC_TOKEN_MODIFIERS.indexOf(mod as (typeof SEMANTIC_TOKEN_MODIFIERS)[number])
    if (idx >= 0) bits |= 1 << idx
  }
  return bits
}

export function semanticTokenRecordsToLsp(records: SemanticTokenRecord[], document: TextDocument): SemanticTokens {
  const builder = new SemanticTokensBuilder()
  const sorted = [...records].sort((a, b) => a.start - b.start)
  for (const record of sorted) {
    const pos = document.positionAt(record.start)
    builder.push(pos.line, pos.character, record.length, TYPE_INDEX[record.type], modifierBits(record.modifiers))
  }
  return builder.build()
}

export function buildSemanticTokens(document: TextDocument): SemanticTokens {
  const source = document.getText()
  const { ast } = parse(source)
  const program = ast && ast.type === 'program' ? ast : null
  const records = buildSemanticTokenRecords(source, program)
  return semanticTokenRecordsToLsp(records, document)
}

/** Textual format for tests: `informal@120-128 type=string` */
export function formatSemanticTokenRecords(records: SemanticTokenRecord[]): string[] {
  return records.map((r) => {
    const label = r.text ?? ''
    return `${label}@${r.start}-${r.start + r.length} type=${r.type}`
  })
}
