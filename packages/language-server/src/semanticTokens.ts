/**
 * Semantic token builder for LSP and tests.
 */

import { parse, textOf, walk } from '@agile-sofl/parser'
import type {
  ProgramNode,
  AtomicPredicateNode,
  PredicateNode,
  ProcessNode,
  ModuleNode,
  Span,
  InformalTextNode,
  ParamGroupNode
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

function pushSpan(
  records: SemanticTokenRecord[],
  span: Span | undefined,
  type: SemanticTokenTypeName,
  modifiers?: string[],
  text?: string
): void {
  if (!span || span.end <= span.start) return
  records.push({
    start: span.start,
    length: span.end - span.start,
    type,
    modifiers,
    text
  })
}

function pushWordInText(
  records: SemanticTokenRecord[],
  span: Span,
  text: string,
  word: string,
  type: SemanticTokenTypeName
): void {
  const idx = text.indexOf(word)
  if (idx < 0) return
  records.push({
    start: span.start + idx,
    length: word.length,
    type,
    text: word
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

function pushInformalAtom(records: SemanticTokenRecord[], atom: AtomicPredicateNode): void {
  if (atom.type !== 'informal_text') return
  const informal = atom as InformalTextNode
  if (!informal.text || informal.span.end <= informal.span.start) return
  records.push({
    start: informal.span.start,
    length: informal.span.end - informal.span.start,
    type: 'string',
    text: informal.text
  })
}

function walkPredicate(pred: PredicateNode, visit: (node: AtomicPredicateNode) => void): void {
  for (const conj of pred.disjuncts) {
    for (const atom of conj.atoms) {
      walkAtom(atom, visit)
    }
  }
}

function pushParamNames(records: SemanticTokenRecord[], groups: ParamGroupNode[]): void {
  for (const group of groups) {
    if (group.nameSpans) {
      for (const ns of group.nameSpans) {
        pushSpan(records, ns.span, 'parameter', ['declaration'], ns.name)
      }
    }
  }
}

function collectProcessTokens(proc: ProcessNode, records: SemanticTokenRecord[]): void {
  pushSpan(records, proc.nameSpan, 'method', ['declaration'], proc.name)

  pushParamNames(records, proc.inputs)
  pushParamNames(records, proc.outputs)

  if (proc.body?.fsf) {
    for (const scenario of proc.body.fsf.scenarios) {
      walkPredicate(scenario.test, (atom) => pushInformalAtom(records, atom))
      walkPredicate(scenario.def, (atom) => pushInformalAtom(records, atom))
    }
    if (proc.body.fsf.others) {
      walkPredicate(proc.body.fsf.others, (atom) => pushInformalAtom(records, atom))
    }
  }

  const decom = proc.body?.decomposition
  if (decom && typeof decom === 'object' && 'span' in decom) {
    pushSpan(records, decom.span, 'parameter', ['readonly'], decom.text)
  }

  const comment = proc.body?.comment
  const commentText = textOf(comment)
  if (commentText && comment && typeof comment === 'object' && 'span' in comment) {
    pushWordInText(records, comment.span, commentText, 'informal', 'keyword')
  }

  for (const ext of proc.body?.ext ?? []) {
    pushSpan(records, ext.span, 'parameter', ['readonly'], ext.name)
  }
}

function collectModuleTokens(mod: ModuleNode, records: SemanticTokenRecord[]): void {
  if (mod.isSystem) {
    pushSpan(records, mod.systemPrefixSpan, 'keyword', undefined, 'SYSTEM_')
    pushSpan(records, mod.nameSpan, 'namespace', ['declaration'], mod.name)
  } else {
    pushSpan(records, mod.nameSpan, 'namespace', ['declaration'], mod.name)
  }

  for (const t of mod.types) {
    pushSpan(records, t.span, 'type', ['declaration'], t.name)
  }
  for (const v of mod.vars) {
    pushSpan(records, v.variable.span, 'variable', ['declaration'], v.variable.name)
  }
  for (const c of mod.consts) {
    pushSpan(records, c.span, 'variable', ['declaration'], c.name)
  }
  for (const p of mod.processes) {
    collectProcessTokens(p, records)
  }
  for (const f of mod.functions) {
    pushSpan(records, f.nameSpan, 'function', ['declaration'], f.name)
    pushParamNames(records, f.params)
    if (f.fsf) {
      for (const scenario of f.fsf.scenarios) {
        walkPredicate(scenario.test, (atom) => pushInformalAtom(records, atom))
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
      collectModuleTokens(mod, records)
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
