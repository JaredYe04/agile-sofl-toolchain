/**
 * AST visitor for editor and analysis tools.
 */

import type { Span } from '../ast/span.js'
import type {
  ProgramNode,
  ModuleNode,
  ProcessNode,
  ProcessBodyNode,
  FunctionNode,
  ExpressionNode,
  TypeExprNode,
  IdentifierNode,
  TypeDeclNode,
  VarDeclNode,
  ConstDeclNode,
  PredicateNode,
  AtomicPredicateNode,
  ConjunctionNode,
  FsfSpecNode,
  InformalTextNode,
  ExtVarNode,
  MaybeTextWithSpan
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
  | TypeExprNode

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
  enterFsfSpec?(node: FsfSpecNode): void
  leaveFsfSpec?(node: FsfSpecNode): void
  enterInformalText?(node: InformalTextNode): void
  leaveInformalText?(node: InformalTextNode): void
  enterProcessBody?(node: ProcessBodyNode): void
  leaveProcessBody?(node: ProcessBodyNode): void
  enterExtVar?(node: ExtVarNode): void
  leaveExtVar?(node: ExtVarNode): void
  enterComment?(comment: MaybeTextWithSpan, body: ProcessBodyNode): void
  enterTypeExpr?(node: TypeExprNode): void
  leaveTypeExpr?(node: TypeExprNode): void
}

export type HybridRegionType = 'fsf' | 'informal' | 'comment' | 'decom'

export interface HybridRegion {
  type: HybridRegionType
  span: Span
  moduleName: string
  processName?: string
  functionName?: string
}

function spanOfText(value: MaybeTextWithSpan | undefined): Span | undefined {
  if (value === undefined) return undefined
  return typeof value === 'string' ? undefined : value.span
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
    walkDeclName(c.span, c.name, visitor)
    visitor.leaveConstDecl?.(c)
  }
  for (const t of mod.types) {
    visitor.enterTypeDecl?.(t)
    walkTypeExpr(t.typeExpr, visitor)
    visitor.leaveTypeDecl?.(t)
  }
  for (const v of mod.vars) {
    visitor.enterVarDecl?.(v)
    walkDeclName(v.variable.span, v.variable.name, visitor)
    walkTypeExpr(v.typeExpr, visitor)
    visitor.leaveVarDecl?.(v)
  }
  for (const inv of mod.invariants) {
    walkPredicate(inv.condition, visitor)
  }
  for (const p of mod.processes) {
    visitor.enterProcess?.(p)
    for (const g of [...p.inputs, ...p.outputs]) {
      for (const name of g.names) walkDeclName(g.span, name, visitor)
      walkTypeExpr(g.typeExpr, visitor)
    }
    walkProcessBody(p, visitor)
    visitor.leaveProcess?.(p)
  }
  for (const f of mod.functions) {
    visitor.enterFunction?.(f)
    if (f.body) walkExpression(f.body, visitor)
    if (f.fsf) {
      visitor.enterFsfSpec?.(f.fsf)
      walkFsf(f.fsf, visitor)
      visitor.leaveFsfSpec?.(f.fsf)
    }
    visitor.leaveFunction?.(f)
  }
  visitor.leaveModule?.(mod)
}

function walkProcessBody(proc: ProcessNode, visitor: Visitor): void {
  const body = proc.body
  if (!body) return
  visitor.enterProcessBody?.(body)
  for (const ext of body.ext) {
    visitor.enterExtVar?.(ext)
    walkDeclName(ext.span, ext.name, visitor)
    if (ext.typeExpr) walkTypeExpr(ext.typeExpr, visitor)
    visitor.leaveExtVar?.(ext)
  }
  if (body.fsf) {
    visitor.enterFsfSpec?.(body.fsf)
    walkFsf(body.fsf, visitor)
    visitor.leaveFsfSpec?.(body.fsf)
  }
  if (body.comment !== undefined) {
    visitor.enterComment?.(body.comment, body)
  }
  visitor.leaveProcessBody?.(body)
}

function walkDeclName(span: import('../ast/span.js').Span, name: string, visitor: Visitor): void {
  const id: IdentifierNode = { type: 'identifier', span, name }
  visitor.enterExpression?.(id)
  visitor.leaveExpression?.(id)
}

function walkTypeExpr(type: TypeExprNode, visitor: Visitor): void {
  visitor.enterTypeExpr?.(type)
  if (type.type === 'named_type') {
    const q = type.qualified
    const id: IdentifierNode = {
      type: 'identifier',
      span: type.span,
      name: q.name,
      qualified: q.module ? q : undefined
    }
    visitor.enterExpression?.(id)
    visitor.leaveExpression?.(id)
  } else if (type.type === 'set_type' || type.type === 'seq_type') {
    walkTypeExpr(type.element, visitor)
  } else if (type.type === 'map_type') {
    walkTypeExpr(type.domain, visitor)
    walkTypeExpr(type.range, visitor)
  } else if (type.type === 'product_type') {
    for (const el of type.elements) walkTypeExpr(el, visitor)
  } else if (type.type === 'union_type') {
    for (const v of type.variants) walkTypeExpr(v, visitor)
  } else if (type.type === 'composed_type') {
    for (const f of type.fields) walkTypeExpr(f.typeExpr, visitor)
  }
  visitor.leaveTypeExpr?.(type)
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
  } else if (atom.type === 'informal_text') {
    visitor.enterInformalText?.(atom)
    visitor.leaveInformalText?.(atom)
  } else if (atom.type !== 'boolean_literal') {
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
    case 'relational_expr':
      walkExpression(expr.left, visitor)
      if (expr.chainMid) walkExpression(expr.chainMid, visitor)
      if (expr.chainHigh) walkExpression(expr.chainHigh, visitor)
      walkExpression(expr.right, visitor)
      break
    case 'unary_minus':
      walkExpression(expr.operand, visitor)
      break
    case 'index_access':
      walkExpression(expr.object, visitor)
      walkExpression(expr.index, visitor)
      break
    case 'field_access':
      walkExpression(expr.object, visitor)
      break
    case 'mk_expr':
      for (const arg of expr.args) walkExpression(arg, visitor)
      break
    case 'modify_expr':
      walkExpression(expr.target, visitor)
      for (const f of expr.fields) walkExpression(f.value, visitor)
      break
    case 'set_expr':
    case 'seq_expr':
      if (expr.elements) for (const el of expr.elements) walkExpression(el, visitor)
      if (expr.rangeLow) walkExpression(expr.rangeLow, visitor)
      if (expr.rangeHigh) walkExpression(expr.rangeHigh, visitor)
      if (expr.compExpr) walkExpression(expr.compExpr, visitor)
      if (expr.compGuard) walkPredicate(expr.compGuard, visitor)
      break
    case 'map_expr':
      if (expr.pairs) for (const p of expr.pairs) {
        walkExpression(p.key, visitor)
        walkExpression(p.value, visitor)
      }
      if (expr.compKey) walkExpression(expr.compKey, visitor)
      if (expr.compValue) walkExpression(expr.compValue, visitor)
      if (expr.compGuard) walkPredicate(expr.compGuard, visitor)
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
    enterAtomic: visit,
    enterTypeExpr: visit
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

interface HybridWalkContext {
  moduleName: string
  processName?: string
  functionName?: string
}

function pushHybridRegion(
  regions: HybridRegion[],
  ctx: HybridWalkContext,
  type: HybridRegionType,
  span: Span | undefined
): void {
  if (!span || span.end <= span.start) return
  regions.push({
    type,
    span,
    moduleName: ctx.moduleName,
    processName: ctx.processName,
    functionName: ctx.functionName
  })
}

function pushTextRegion(
  regions: HybridRegion[],
  ctx: HybridWalkContext,
  type: 'comment' | 'decom',
  value: MaybeTextWithSpan | undefined
): void {
  if (value === undefined) return
  pushHybridRegion(regions, ctx, type, spanOfText(value))
}

/** Collect FSF, informal, comment, and decomposition regions for hybrid editor UI. */
export function collectHybridRegions(ast: ProgramNode): HybridRegion[] {
  const regions: HybridRegion[] = []
  const ctx: HybridWalkContext = { moduleName: '' }

  walk(ast, {
    enterModule(mod) {
      ctx.moduleName = mod.name
      ctx.processName = undefined
      ctx.functionName = undefined
    },
    enterProcess(proc) {
      ctx.processName = proc.name
      ctx.functionName = undefined
    },
    leaveProcess() {
      ctx.processName = undefined
    },
    enterFunction(fn) {
      ctx.functionName = fn.name
      ctx.processName = undefined
    },
    leaveFunction() {
      ctx.functionName = undefined
    },
    enterFsfSpec(node) {
      pushHybridRegion(regions, ctx, 'fsf', node.span)
    },
    enterInformalText(node) {
      pushHybridRegion(regions, ctx, 'informal', node.span)
    },
    enterProcessBody(body) {
      pushTextRegion(regions, ctx, 'decom', body.decomposition)
      pushTextRegion(regions, ctx, 'comment', body.comment)
    }
  })

  return regions
}
