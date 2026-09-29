/**
 * Operational grain: one trigger and one effect, judged from the predicate shape
 * and from variations the author already wrote. This is not an operation catalog.
 */

import type { AtomicPredicateNode, ExpressionNode, PredicateNode, ProcessNode, ProgramNode } from '../ast/nodes.js'
import { textOf } from '../ast/nodes.js'
import { deriveFsf } from '../fsf/deriver.js'

export type EffectPattern = 'insert' | 'update' | 'remove' | 'query' | 'batch' | 'mixed' | 'opaque'

export type VariationSource = 'author-text' | 'effect' | 'step'

export type VariationDisposition = 'unresolved' | 'scenario' | 'child' | 'waived'

export interface GrainVariation {
  id: string
  text: string
  source: VariationSource
  disposition: VariationDisposition
  /** Set when a ResolveVariation step names the child process. */
  childName?: string
}

export interface AuthorTextNote {
  processName: string
  text: string
}

export interface ProcessGrain {
  moduleName: string
  processName: string
  hasDecom: boolean
  effectPattern: EffectPattern
  /** Concern wording is wider than the single effect observed in post. */
  nameEffectMismatch: boolean
  derivedScenarioCount: number
  /** Process names in the decom target module, when that module exists. */
  childProcessNames: string[]
  variations: GrainVariation[]
}

export interface ProcessGrainReport {
  processes: ProcessGrain[]
}

const CONCERN_MARKER = /维护|管理|处理|负责|\bmaintain\b|\bmanage\b|\bhandle\b/i
const CONCRETE: ReadonlySet<EffectPattern> = new Set(['insert', 'update', 'remove', 'query', 'batch'])

/** Split a list the author already wrote. Prose without a list marker yields nothing. */
export function extractAuthorVariations(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const chunks = lines.length > 1 ? [...lines, text.trim()] : [text.trim()]
  const found: string[] = []
  for (const chunk of chunks) {
    for (const part of extractOneList(chunk)) {
      if (!found.includes(part)) found.push(part)
    }
  }
  return found
}

function extractOneList(text: string): string[] {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed || trimmed.length > 240) return []
  const cjkList = /包括|以及|、/.test(trimmed)
  const enList = /\b(?:and|or)\b/i.test(trimmed) && trimmed.length <= 80 && !/[.。]/.test(trimmed)
  if (!cjkList && !enList) return []
  let body = trimmed
  const intro = /包括|以及/.exec(trimmed)
  if (intro && intro.index !== undefined) body = trimmed.slice(intro.index + intro[0].length).trim()
  const parts = body
    .split(/\s*(?:、|，|,|；|;|以及|\band\b|\bor\b)\s*/i)
    .map((part) => part.replace(/^[-\d.)\s]+/, '').replace(/[。.]/g, '').trim())
    .filter((part) => part.length >= 2 && part.length <= 32)
  const unique: string[] = []
  for (const part of parts) {
    if (!unique.includes(part)) unique.push(part)
  }
  if (unique.length < 2 || unique.length > 8) return []
  return unique
}

/** Heading bodies from an Informal markdown document, matched later by process name. */
export function authorNotesFromInformalMarkdown(markdown: string): AuthorTextNote[] {
  const notes: AuthorTextNote[] = []
  let title = ''
  const body: string[] = []
  const flush = () => {
    const text = body.join('\n').trim()
    if (title && text) notes.push({ processName: title, text })
    body.length = 0
  }
  for (const line of markdown.split(/\r?\n/)) {
    const match = /^(#{2,6})\s+(.+)$/.exec(line)
    if (match) {
      flush()
      title = match[2]!.replace(/<!--[\s\S]*?-->/g, '').trim()
      continue
    }
    if (title) body.push(line)
  }
  flush()
  return notes
}

export function analyzeProcessGrain(program: ProgramNode, notes: AuthorTextNote[] = []): ProcessGrainReport {
  const processes: ProcessGrain[] = []
  for (const mod of program.modules) {
    for (const proc of mod.processes) {
      if (proc.alias) continue
      processes.push(grainOf(program, mod.name, proc, notes))
    }
  }
  return { processes }
}

function grainOf(program: ProgramNode, moduleName: string, proc: ProcessNode, notes: AuthorTextNote[]): ProcessGrain {
  const comment = textOf(proc.body?.comment)?.trim() ?? ''
  const decomTarget = textOf(proc.body?.decomposition)?.trim() ?? ''
  const hasDecom = Boolean(decomTarget)
  const noteText = notes
    .filter((note) => note.processName === proc.name)
    .map((note) => note.text)
    .join('\n')
  const effectPattern = observeEffectPattern(proc)
  const claim = [proc.name, comment, noteText].filter(Boolean).join('\n')
  const nameEffectMismatch = !hasDecom && CONCRETE.has(effectPattern) && CONCERN_MARKER.test(claim)
  const variations = variationsFromText([comment, noteText, listLikeName(proc.name)].filter(Boolean).join('\n'))
  const form = safeScenarios(proc)
  return {
    moduleName,
    processName: proc.name,
    hasDecom,
    effectPattern,
    nameEffectMismatch,
    derivedScenarioCount: form,
    childProcessNames: childNames(program, decomTarget),
    variations
  }
}

function listLikeName(name: string): string {
  return /、|\/|以及/.test(name) ? name : ''
}

function safeScenarios(proc: ProcessNode): number {
  try {
    return deriveFsf(proc)?.scenarios.length ?? 0
  } catch {
    return 0
  }
}

function childNames(program: ProgramNode, decomTarget: string): string[] {
  if (!decomTarget) return []
  const bare = decomTarget.startsWith('SYSTEM_') ? decomTarget.slice('SYSTEM_'.length) : decomTarget
  const mod = program.modules.find(
    (item) => item.name === decomTarget || item.name === bare || `SYSTEM_${item.name}` === decomTarget
  )
  return mod ? mod.processes.filter((proc) => !proc.alias).map((proc) => proc.name) : []
}

export function observeEffectPattern(proc: ProcessNode): EffectPattern {
  const post = proc.body?.post
  if (!post) return 'opaque'
  const tags = new Set<EffectTag>()
  const text = post.text ?? ''
  if (/\b(?:union|dunion)\b/i.test(text)) tags.add('insert')
  if (/\bdiff\b/i.test(text)) tags.add('remove')
  if (/\boverride\b|\bmodify\s*\(/i.test(text)) tags.add('update')
  let comprehension = false
  walkPredicate(post.predicate, (expr) => {
    if (expr.type === 'call') {
      const name = typeof expr.callee === 'string' ? expr.callee : ''
      if (name === 'union' || name === 'dunion') tags.add('insert')
      else if (name === 'diff') tags.add('remove')
      else if (name === 'override') tags.add('update')
    } else if (expr.type === 'modify_expr') {
      tags.add('update')
    } else if ((expr.type === 'set_expr' || expr.type === 'seq_expr') && expr.kind === 'comprehension') {
      comprehension = true
    }
  })
  if (comprehension && tags.size === 0) tags.add('batch')
  if (tags.size > 1) return 'mixed'
  if (tags.size === 1) return [...tags][0]!
  const ext = proc.body?.ext ?? []
  const writes = ext.some((item) => item.access === 'wr')
  if (!writes && proc.outputs.length > 0) return 'query'
  return 'opaque'
}

type EffectTag = 'insert' | 'update' | 'remove' | 'batch'

function variationsFromText(text: string): GrainVariation[] {
  return extractAuthorVariations(text).map((part, index) => ({
    id: `v${index}:${part.replace(/\s+/g, '-').slice(0, 40)}`,
    text: part,
    source: 'author-text' as const,
    disposition: 'unresolved' as const
  }))
}

function walkPredicate(pred: PredicateNode | undefined, visit: (expr: ExpressionNode) => void): void {
  if (!pred) return
  for (const conj of pred.disjuncts) {
    for (const atom of conj.atoms) walkAtom(atom, visit)
  }
}

function walkAtom(atom: AtomicPredicateNode, visit: (expr: ExpressionNode) => void): void {
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
    return
  }
  if (atom.type === 'relational_expr' || atom.type === 'call' || atom.type === 'modify_expr' || atom.type === 'binary_op') {
    walkExpr(atom, visit)
  }
}

function walkExpr(expr: ExpressionNode | undefined, visit: (expr: ExpressionNode) => void): void {
  if (!expr) return
  visit(expr)
  switch (expr.type) {
    case 'binary_op':
      walkExpr(expr.left, visit)
      walkExpr(expr.right, visit)
      break
    case 'unary_minus':
      walkExpr(expr.operand, visit)
      break
    case 'paren_expr':
      walkExpr(expr.inner, visit)
      break
    case 'call':
      if (typeof expr.callee !== 'string') walkExpr(expr.callee, visit)
      for (const arg of expr.args) walkExpr(arg, visit)
      break
    case 'relational_expr':
      walkExpr(expr.left, visit)
      walkExpr(expr.right, visit)
      break
    case 'modify_expr':
      walkExpr(expr.target, visit)
      for (const field of expr.fields) walkExpr(field.value, visit)
      break
    case 'if_expr':
      walkExpr(expr.thenExpr, visit)
      walkExpr(expr.elseExpr, visit)
      break
    case 'let_expr':
      walkExpr(expr.body, visit)
      break
    case 'set_expr':
    case 'seq_expr':
      for (const element of expr.elements ?? []) walkExpr(element, visit)
      walkExpr(expr.compExpr, visit)
      break
    case 'field_access':
      walkExpr(expr.object, visit)
      break
    default:
      break
  }
}
