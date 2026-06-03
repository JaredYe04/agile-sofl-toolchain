/**
 * AST visitor for editor and analysis tools.
 */

import type {
  ProgramNode,
  ModuleNode,
  ProcessNode,
  FunctionNode,
  ExpressionNode,
  TypeDeclNode,
  VarDeclNode,
  ConstDeclNode,
  PredicateNode,
  AtomicPredicateNode,
  ConjunctionNode,
  FsfSpecNode
} from '../ast/nodes.js'

export type AstNode =
  | ProgramNode
  | ModuleNode
  | ProcessNode
  | FunctionNode
  | TypeDeclNode
  | VarDeclNode
  | ConstDeclNode
  | PredicateNode
  | ConjunctionNode
  | AtomicPredicateNode
  | ExpressionNode

export interface Visitor {
  enterProgram?(node: ProgramNode): void
  leaveProgram?(node: ProgramNode): void
  enterModule?(node: ModuleNode): void
  leaveModule?(node: ModuleNode): void
  enterConstDecl?(node: ConstDeclNode): void
  leaveConstDecl?(node: ConstDeclNode): void
  enterTypeDecl?(node: TypeDeclNode): void
  leaveTypeDecl?(node: TypeDeclNode): void
  enterVarDecl?(node: VarDeclNode): void
  leaveVarDecl?(node: VarDeclNode): void
  enterProcess?(node: ProcessNode): void
  leaveProcess?(node: ProcessNode): void
  enterFunction?(node: FunctionNode): void
  leaveFunction?(node: FunctionNode): void
  enterExpression?(node: ExpressionNode): void
  leaveExpression?(node: ExpressionNode): void
  enterPredicate?(node: PredicateNode): void
  leavePredicate?(node: PredicateNode): void
  enterAtomic?(node: AtomicPredicateNode): void
  leaveAtomic?(node: AtomicPredicateNode): void
}

export function walk(ast: ProgramNode, visitor: Visitor): void {
  visitor.enterProgram?.(ast)
  for (const mod of ast.modules) {
    walkModule(mod, visitor)
  }
  visitor.leaveProgram?.(ast)
}

function walkModule(mod: ModuleNode, visitor: Visitor): void {
  visitor.enterModule?.(mod)
  for (const c of mod.consts) {
    visitor.enterConstDecl?.(c)
    visitor.leaveConstDecl?.(c)
  }
  for (const t of mod.types) {
    visitor.enterTypeDecl?.(t)
    visitor.leaveTypeDecl?.(t)
  }
  for (const v of mod.vars) {
    visitor.enterVarDecl?.(v)
    visitor.leaveVarDecl?.(v)
  }
  for (const inv of mod.invariants) {
    walkPredicate(inv.condition, visitor)
  }
  for (const p of mod.processes) {
    visitor.enterProcess?.(p)
    walkProcessBody(p, visitor)
    visitor.leaveProcess?.(p)
  }
  for (const f of mod.functions) {
    visitor.enterFunction?.(f)
    if (f.body) walkExpression(f.body, visitor)
    if (f.fsf) walkFsf(f.fsf, visitor)
    visitor.leaveFunction?.(f)
  }
  visitor.leaveModule?.(mod)
}

function walkProcessBody(proc: ProcessNode, visitor: Visitor): void {
  const body = proc.body
  if (!body) return
  if (body.fsf) walkFsf(body.fsf, visitor)
}

function walkFsf(fsf: FsfSpecNode, visitor: Visitor): void {
  for (const scenario of fsf.scenarios) {
    walkPredicate(scenario.test, visitor)
    walkPredicate(scenario.def, visitor)
  }
  if (fsf.others) walkPredicate(fsf.others, visitor)
}

function walkPredicate(pred: PredicateNode, visitor: Visitor): void {
  visitor.enterPredicate?.(pred)
  for (const conj of pred.disjuncts) {
    walkConjunction(conj, visitor)
  }
  visitor.leavePredicate?.(pred)
}

function walkConjunction(conj: ConjunctionNode, visitor: Visitor): void {
  for (const atom of conj.atoms) {
    walkAtomic(atom, visitor)
  }
}

function walkAtomic(atom: AtomicPredicateNode, visitor: Visitor): void {
  visitor.enterAtomic?.(atom)
  if (atom.type === 'not_predicate') {
    walkAtomic(atom.operand, visitor)
  } else if (atom.type === 'paren_predicate') {
    walkAtomic(atom.inner, visitor)
  } else if (atom.type === 'quantified') {
    walkPredicate(atom.body, visitor)
    for (const nested of atom.nestedQuantifiers) {
      walkPredicate(nested.body, visitor)
    }
  } else if (atom.type !== 'informal_text' && atom.type !== 'boolean_literal') {
    walkExpression(atom, visitor)
  }
  visitor.leaveAtomic?.(atom)
}

function walkExpression(expr: ExpressionNode, visitor: Visitor): void {
  visitor.enterExpression?.(expr)
  switch (expr.type) {
    case 'binary_op':
      walkExpression(expr.left, visitor)
      walkExpression(expr.right, visitor)
      break
    case 'paren_expr':
      walkExpression(expr.inner, visitor)
      break
    case 'if_expr':
      walkPredicate(expr.condition, visitor)
      walkExpression(expr.thenExpr, visitor)
      walkExpression(expr.elseExpr, visitor)
      break
    case 'let_expr':
      for (const b of expr.bindings) {
        if (b.guard) walkPredicate(b.guard, visitor)
        if (b.value) walkExpression(b.value, visitor)
      }
      walkExpression(expr.body, visitor)
      break
    case 'field_access':
      walkExpression(expr.object, visitor)
      break
    case 'call':
      if (typeof expr.callee !== 'string') walkExpression(expr.callee, visitor)
      for (const arg of expr.args) walkExpression(arg, visitor)
      break
    case 'case_expr':
      walkExpression(expr.scrutinee, visitor)
      for (const alt of expr.alternatives) {
        walkExpression(alt.expr, visitor)
      }
      if (expr.default) walkExpression(expr.default, visitor)
      break
    default:
      break
  }
  visitor.leaveExpression?.(expr)
}

type Spanned = { span?: { start: number; end: number } }

export function visitAllNodes(ast: ProgramNode, visit: (node: AstNode) => void): void {
  walk(ast, {
    enterProgram: visit,
    enterModule: visit,
    enterConstDecl: visit,
    enterTypeDecl: visit,
    enterVarDecl: visit,
    enterProcess: visit,
    enterFunction: visit,
    enterExpression: visit,
    enterPredicate: visit,
    enterAtomic: visit
  })
}

export function findNodeAtOffset(ast: ProgramNode, offset: number): AstNode | null {
  let best: AstNode | null = null
  let bestLen = Infinity
  visitAllNodes(ast, (node) => {
    const span = (node as Spanned).span
    if (!span || (span.start === 0 && span.end === 0)) return
    if (offset >= span.start && offset <= span.end && span.end - span.start < bestLen) {
      best = node
      bestLen = span.end - span.start
    }
  })
  return best
}

/** @deprecated Use findNodeAtOffset */
export function getNodeAtOffset(ast: ProgramNode, offset: number): unknown | null {
  return findNodeAtOffset(ast, offset)
}
