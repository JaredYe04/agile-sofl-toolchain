import { parse, printPredicate, printExpr, printType, type PredicateNode, type Diagnostic } from '@agile-sofl/parser'

export type PredicateUiNode =
  | { kind: 'or'; children: PredicateUiNode[] }
  | { kind: 'and'; children: PredicateUiNode[] }
  | { kind: 'not'; child: PredicateUiNode }
  | {
      kind: 'quantified'
      quantifier: 'forall' | 'exists' | 'exists_unique'
      bindings: string
      nested: string[]
      body: PredicateUiNode
    }
  | { kind: 'relational'; left: string; op: string; right: string; text: string }
  | { kind: 'informal'; text: string }
  | { kind: 'expr'; text: string }
  | { kind: 'literal'; value: 'true' | 'false' }
  | { kind: 'code'; text: string }

export type ParsePredicateResult = {
  predicate: PredicateNode | null
  diagnostics: Diagnostic[]
  error: string | null
}

const REL_OPS = {
  eq: '=',
  neq: '<>',
  lt: '<',
  le: '<=',
  gt: '>',
  ge: '>=',
  chain_lt: '<',
  chain_gt: '>',
  inset: 'inset',
  notin: 'notin'
} as const

/** Parse a predicate fragment via a temporary inv wrapper. */
export function parsePredicateFragment(text: string): ParsePredicateResult {
  const trimmed = text.trim()
  if (!trimmed) {
    return { predicate: null, diagnostics: [], error: null }
  }
  const src = `module SYSTEM_ParseStub;\ninv\n${trimmed};\nend_module.`
  const { ast, diagnostics } = parse(src)
  if (!ast || ast.type !== 'program') {
    return { predicate: null, diagnostics, error: 'Could not parse predicate' }
  }
  const inv = ast.modules[0]?.invariants[0]
  if (!inv) {
    return { predicate: null, diagnostics, error: 'Could not parse predicate' }
  }
  return { predicate: inv.condition, diagnostics, error: null }
}

function atomToText(atom: PredicateNode['disjuncts'][0]['atoms'][0]): string {
  return printPredicate({
    type: 'predicate',
    disjuncts: [{ type: 'conjunction', atoms: [atom], span: atom.span }],
    span: atom.span
  })
}

export function predicateToUi(pred: PredicateNode): PredicateUiNode {
  if (pred.disjuncts.length > 1) {
    return {
      kind: 'or',
      children: pred.disjuncts.map((c) => conjunctionToUi(c.atoms))
    }
  }
  return conjunctionToUi(pred.disjuncts[0]?.atoms ?? [])
}

function conjunctionToUi(atoms: PredicateNode['disjuncts'][0]['atoms']): PredicateUiNode {
  if (atoms.length > 1) {
    return { kind: 'and', children: atoms.map(atomToUi) }
  }
  return atomToUi(atoms[0] ?? { type: 'boolean_literal', value: true, span: { start: 0, end: 0, line: 1, column: 1 } })
}

function bindingGroupsText(bindings: import('@agile-sofl/parser').QuantifiedNode['bindings']): string {
  return bindings.map((b) => `${b.names.join(',')}: ${printType(b.typeExpr)}`).join(', ')
}

function nestedQuantText(nested: import('@agile-sofl/parser').QuantifiedNode[]): string[] {
  return nested.map((n) => {
    const q = n.quantifier === 'exists_unique' ? 'exists!' : n.quantifier
    return `${q}[${bindingGroupsText(n.bindings)}]`
  })
}

function atomToUi(atom: PredicateNode['disjuncts'][0]['atoms'][0]): PredicateUiNode {
  if (atom.type === 'informal_text') return { kind: 'informal', text: atom.text }
  if (atom.type === 'boolean_literal') return { kind: 'literal', value: atom.value ? 'true' : 'false' }
  if (atom.type === 'paren_predicate') return atomToUi(atom.inner)
  if (atom.type === 'not_predicate') {
    const inner = atom.operand
    if (inner.type === 'paren_predicate' || inner.type === 'quantified' || inner.type === 'not_predicate') {
      return { kind: 'not', child: atomToUi(inner) }
    }
    return { kind: 'not', child: predicateToUi({ type: 'predicate', disjuncts: [{ type: 'conjunction', atoms: [inner], span: inner.span }], span: inner.span }) }
  }
  if (atom.type === 'quantified') {
    return {
      kind: 'quantified',
      quantifier: atom.quantifier,
      bindings: bindingGroupsText(atom.bindings),
      nested: nestedQuantText(atom.nestedQuantifiers),
      body: predicateToUi(atom.body)
    }
  }
  if (atom.type === 'relational_expr') {
    const text = printExpr(atom)
    return {
      kind: 'relational',
      left: printExpr(atom.left),
      op: REL_OPS[atom.kind] ?? atom.kind,
      right: printExpr(atom.right),
      text
    }
  }
  return { kind: 'expr', text: atomToText(atom) }
}

export function printPredicateText(pred: PredicateNode): string {
  return printPredicate(pred)
}

function uiToPredicateTextRaw(node: PredicateUiNode): string {
  if (node.kind === 'code') return node.text
  if (node.kind === 'literal') return node.value
  if (node.kind === 'informal') return node.text
  if (node.kind === 'relational') {
    if (node.left && node.op && node.right) return `${node.left} ${node.op} ${node.right}`
    return node.text
  }
  if (node.kind === 'expr') return node.text
  if (node.kind === 'not') return `not ${uiToPredicateTextRaw(node.child)}`
  if (node.kind === 'and') return node.children.map(uiToPredicateTextRaw).join(' and ')
  if (node.kind === 'or') return node.children.map(uiToPredicateTextRaw).join(' or ')
  if (node.kind === 'quantified') {
    const q = node.quantifier === 'exists_unique' ? 'exists!' : node.quantifier
    const nested = node.nested.length ? ` ${node.nested.join(' ')}` : ''
    return `${q}[${node.bindings}]${nested} | ${uiToPredicateTextRaw(node.body)}`
  }
  return ''
}

/** Serialize UI tree; re-parse when possible for canonical output. */
export function uiToPredicateText(node: PredicateUiNode): string {
  const raw = uiToPredicateTextRaw(node)
  if (!raw.trim()) return raw
  const { predicate, error } = parsePredicateFragment(raw)
  if (predicate && !error) return printPredicateText(predicate)
  return raw
}

export function parsePredicateUi(text: string): { ui: PredicateUiNode | null; error: string | null } {
  const { predicate, error } = parsePredicateFragment(text)
  if (!predicate) return { ui: text.trim() ? { kind: 'code', text: text.trim() } : null, error }
  return { ui: predicateToUi(predicate), error: null }
}

export function updateUiLeafText(node: PredicateUiNode, text: string): PredicateUiNode {
  if (node.kind === 'relational') {
    const copy = { ...node, text }
    const m = text.match(/^(.+?)\s*(=|<>|<=|>=|<|>|inset|notin)\s*(.+)$/)
    if (m) {
      copy.left = m[1]!.trim()
      copy.op = m[2]!
      copy.right = m[3]!.trim()
    }
    return copy
  }
  if (node.kind === 'informal' || node.kind === 'expr' || node.kind === 'code') {
    return { ...node, text }
  }
  return node
}

export type SymbolHint = { label: string; kind: 'var' | 'const' | 'type' | 'param' | 'keyword' }

export function filterSymbolHints(symbols: SymbolHint[], prefix: string): SymbolHint[] {
  const p = prefix.toLowerCase()
  if (!p) return symbols.slice(0, 20)
  return symbols.filter((s) => s.label.toLowerCase().startsWith(p)).slice(0, 20)
}
