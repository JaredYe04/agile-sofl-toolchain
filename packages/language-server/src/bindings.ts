/**
 * Quantifier and comprehension binding lookup at cursor offset.
 */

import type {
  ProgramNode,
  QuantifiedNode,
  PredicateNode,
  AtomicPredicateNode,
  Span,
  TypeExprNode
} from '@agile-sofl/parser'

export interface BindingAtOffset {
  name: string
  typeExpr: TypeExprNode
  span: Span
}

type ExprNode = { type: string; span: Span; [key: string]: unknown }

function pushBindings(groups: QuantifiedNode['bindings'] | undefined, out: BindingAtOffset[]): void {
  if (!groups) return
  for (const group of groups) {
    for (const name of group.names) {
      out.push({ name, typeExpr: group.typeExpr, span: group.span })
    }
  }
}

function walkQuantifiers(
  program: ProgramNode,
  offset: number,
  onMatch: (q: QuantifiedNode) => void
): void {
  for (const mod of program.modules) {
    for (const inv of mod.invariants) {
      walkPredicateForQuant(inv.condition, offset, onMatch)
    }
    for (const proc of mod.processes) {
      const fsf = proc.body?.fsf
      if (!fsf) continue
      for (const sc of fsf.scenarios) {
        walkPredicateForQuant(sc.test, offset, onMatch)
        walkPredicateForQuant(sc.def, offset, onMatch)
      }
      if (fsf.others) walkPredicateForQuant(fsf.others, offset, onMatch)
    }
    for (const fn of mod.functions) {
      if (fn.fsf) {
        for (const sc of fn.fsf.scenarios) {
          walkPredicateForQuant(sc.test, offset, onMatch)
        }
      }
      if (fn.body) walkExpressionForComprehension(fn.body as ExprNode, offset, onMatch)
    }
    for (const c of mod.consts) {
      walkExpressionForComprehension(c.value as ExprNode, offset, onMatch)
    }
  }
}

function walkPredicateForQuant(
  pred: PredicateNode,
  offset: number,
  onMatch: (q: QuantifiedNode) => void
): void {
  for (const conj of pred.disjuncts) {
    for (const atom of conj.atoms) {
      walkAtomForQuant(atom, offset, onMatch)
    }
  }
}

function walkAtomForQuant(
  atom: AtomicPredicateNode,
  offset: number,
  onMatch: (q: QuantifiedNode) => void
): void {
  if (atom.type === 'quantified') {
    if (offset >= atom.span.start && offset <= atom.span.end) {
      onMatch(atom)
    }
    walkPredicateForQuant(atom.body, offset, onMatch)
    for (const nested of atom.nestedQuantifiers) {
      walkAtomForQuant(nested, offset, onMatch)
    }
    return
  }
  if (atom.type === 'not_predicate') {
    walkAtomForQuant(atom.operand, offset, onMatch)
    return
  }
  if (atom.type === 'paren_predicate') {
    walkAtomForQuant(atom.inner, offset, onMatch)
  } else if (atom.type !== 'informal_text' && atom.type !== 'boolean_literal') {
    walkExpressionForComprehension(atom as ExprNode, offset, onMatch)
  }
}

function visitComprehensionExpr(expr: ExprNode, offset: number, onMatch: (q: QuantifiedNode) => void): void {
  if (expr.kind !== 'comprehension' || offset < expr.span.start || offset > expr.span.end) return
  const pseudo: QuantifiedNode = {
    type: 'quantified',
    span: expr.span,
    quantifier: 'forall',
    bindings: (expr.compBindings as QuantifiedNode['bindings']) ?? [],
    nestedQuantifiers: [],
    body: { type: 'predicate', span: expr.span, disjuncts: [] }
  }
  onMatch(pseudo)
  if (expr.compGuard) walkPredicateForQuant(expr.compGuard as PredicateNode, offset, onMatch)
  if (expr.compExpr) walkExpressionForComprehension(expr.compExpr as ExprNode, offset, onMatch)
  if (expr.compKey) walkExpressionForComprehension(expr.compKey as ExprNode, offset, onMatch)
  if (expr.compValue) walkExpressionForComprehension(expr.compValue as ExprNode, offset, onMatch)
}

function walkExpressionForComprehension(
  expr: ExprNode,
  offset: number,
  onMatch: (q: QuantifiedNode) => void
): void {
  switch (expr.type) {
    case 'binary_op':
      walkExpressionForComprehension(expr.left as ExprNode, offset, onMatch)
      walkExpressionForComprehension(expr.right as ExprNode, offset, onMatch)
      break
    case 'paren_expr':
      walkExpressionForComprehension(expr.inner as ExprNode, offset, onMatch)
      break
    case 'if_expr':
      walkPredicateForQuant(expr.condition as PredicateNode, offset, onMatch)
      walkExpressionForComprehension(expr.thenExpr as ExprNode, offset, onMatch)
      walkExpressionForComprehension(expr.elseExpr as ExprNode, offset, onMatch)
      break
    case 'let_expr':
      for (const b of expr.bindings as Array<{ value?: ExprNode }>) {
        if (b.value) walkExpressionForComprehension(b.value, offset, onMatch)
      }
      walkExpressionForComprehension(expr.body as ExprNode, offset, onMatch)
      break
    case 'relational_expr':
      walkExpressionForComprehension(expr.left as ExprNode, offset, onMatch)
      if (expr.chainMid) walkExpressionForComprehension(expr.chainMid as ExprNode, offset, onMatch)
      if (expr.chainHigh) walkExpressionForComprehension(expr.chainHigh as ExprNode, offset, onMatch)
      walkExpressionForComprehension(expr.right as ExprNode, offset, onMatch)
      break
    case 'unary_minus':
      walkExpressionForComprehension(expr.operand as ExprNode, offset, onMatch)
      break
    case 'index_access':
      walkExpressionForComprehension(expr.object as ExprNode, offset, onMatch)
      walkExpressionForComprehension(expr.index as ExprNode, offset, onMatch)
      break
    case 'mk_expr':
      for (const a of expr.args as ExprNode[]) walkExpressionForComprehension(a, offset, onMatch)
      break
    case 'modify_expr':
      walkExpressionForComprehension(expr.target as ExprNode, offset, onMatch)
      for (const f of expr.fields as Array<{ value: ExprNode }>) {
        walkExpressionForComprehension(f.value, offset, onMatch)
      }
      break
    case 'set_expr':
    case 'seq_expr':
    case 'map_expr':
      visitComprehensionExpr(expr, offset, onMatch)
      if (expr.elements) {
        for (const el of expr.elements as ExprNode[]) walkExpressionForComprehension(el, offset, onMatch)
      }
      break
    case 'call':
      if (typeof expr.callee !== 'string') {
        walkExpressionForComprehension(expr.callee as ExprNode, offset, onMatch)
      }
      for (const a of expr.args as ExprNode[]) walkExpressionForComprehension(a, offset, onMatch)
      break
    case 'case_expr':
      walkExpressionForComprehension(expr.scrutinee as ExprNode, offset, onMatch)
      for (const alt of expr.alternatives as Array<{ expr: ExprNode }>) {
        walkExpressionForComprehension(alt.expr, offset, onMatch)
      }
      if (expr.default) walkExpressionForComprehension(expr.default as ExprNode, offset, onMatch)
      break
    default:
      break
  }
}

function identifierAtOffset(
  source: string,
  offset: number
): { name: string; start: number; end: number } | null {
  if (offset < 0 || offset >= source.length) return null
  let start = offset
  while (start > 0 && /[A-Za-z0-9_]/.test(source[start - 1]!)) start--
  let end = offset
  while (end < source.length && /[A-Za-z0-9_]/.test(source[end]!)) end++
  if (start >= end) return null
  const name = source.slice(start, end)
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return null
  return { name, start, end }
}

/** All quantifier/comprehension bindings enclosing `offset`. */
export function bindingsAtOffset(program: ProgramNode, offset: number): BindingAtOffset[] {
  const bindings: BindingAtOffset[] = []
  walkQuantifiers(program, offset, (q) => {
    pushBindings(q.bindings, bindings)
    for (const nested of q.nestedQuantifiers) {
      pushBindings(nested.bindings, bindings)
    }
  })
  return bindings
}

/** Binding whose name span contains `offset`, if any. */
export function bindingAtOffset(program: ProgramNode, offset: number, source: string): BindingAtOffset | null {
  const id = identifierAtOffset(source, offset)
  if (!id) return null
  const binding = bindingsAtOffset(program, offset).find((b) => b.name === id.name)
  if (!binding) return null
  return { ...binding, span: { ...binding.span, start: id.start, end: id.end, line: binding.span.line, column: binding.span.column } }
}

export function bindingNamesAtOffset(program: ProgramNode, offset: number): string[] {
  return [...new Set(bindingsAtOffset(program, offset).map((b) => b.name))]
}
