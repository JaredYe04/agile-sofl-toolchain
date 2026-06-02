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
  ConstDeclNode
} from '../ast/nodes.js'

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
  for (const p of mod.processes) {
    visitor.enterProcess?.(p)
    visitor.leaveProcess?.(p)
  }
  for (const f of mod.functions) {
    visitor.enterFunction?.(f)
    if (f.body) walkExpression(f.body, visitor)
    visitor.leaveFunction?.(f)
  }
  visitor.leaveModule?.(mod)
}

function walkExpression(expr: ExpressionNode, visitor: Visitor): void {
  visitor.enterExpression?.(expr)
  if (expr.type === 'binary_op') {
    walkExpression(expr.left, visitor)
    walkExpression(expr.right, visitor)
  } else if (expr.type === 'paren_expr') {
    walkExpression(expr.inner, visitor)
  } else if (expr.type === 'if_expr') {
    walkExpression(expr.thenExpr, visitor)
    walkExpression(expr.elseExpr, visitor)
  } else if (expr.type === 'let_expr') {
    walkExpression(expr.body, visitor)
  } else if (expr.type === 'field_access') {
    walkExpression(expr.object, visitor)
  } else if (expr.type === 'call') {
    for (const arg of expr.args) walkExpression(arg, visitor)
  }
  visitor.leaveExpression?.(expr)
}

export function getNodeAtOffset(ast: ProgramNode, offset: number): unknown | null {
  let found: unknown = null
  const checkSpan = (node: { span?: { start: number; end: number } }) => {
    if (node.span && offset >= node.span.start && offset <= node.span.end) {
      found = node
    }
  }
  walk(ast, {
    enterModule: checkSpan,
    enterProcess: checkSpan,
    enterFunction: checkSpan,
    enterExpression: checkSpan
  })
  return found
}
