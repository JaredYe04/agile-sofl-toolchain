/**
 * Type guards for AST nodes.
 */

import type {
  ProgramNode,
  ModuleNode,
  ProcessNode,
  FunctionNode,
  ExpressionNode,
  TypeExprNode,
  PredicateNode,
  AtomicPredicateNode,
  FsfSpecNode,
  ConstDeclNode,
  TypeDeclNode,
  VarDeclNode,
  InvariantNode
} from './nodes'

export function isProgramNode(n: unknown): n is ProgramNode {
  return typeof n === 'object' && n !== null && (n as ProgramNode).type === 'program'
}

export function isModuleNode(n: unknown): n is ModuleNode {
  return typeof n === 'object' && n !== null && (n as ModuleNode).type === 'module'
}

export function isProcessNode(n: unknown): n is ProcessNode {
  return typeof n === 'object' && n !== null && (n as ProcessNode).type === 'process'
}

export function isFunctionNode(n: unknown): n is FunctionNode {
  return typeof n === 'object' && n !== null && (n as FunctionNode).type === 'function'
}

export function isExpressionNode(n: unknown): n is ExpressionNode {
  if (typeof n !== 'object' || n === null) return false
  const t = (n as { type: string }).type
  return [
    'nil', 'boolean_literal', 'number_literal', 'char_literal', 'string_literal',
    'enum_literal', 'identifier', 'unary_minus', 'binary_op', 'call', 'field_access',
    'index_access', 'if_expr', 'let_expr', 'case_expr', 'set_expr', 'seq_expr',
    'map_expr', 'mk_expr', 'modify_expr', 'paren_expr', 'relational_expr'
  ].includes(t)
}

export function isTypeExprNode(n: unknown): n is TypeExprNode {
  if (typeof n !== 'object' || n === null) return false
  const t = (n as { type: string }).type
  return [
    'basic_type', 'named_type', 'enum_type', 'set_type', 'seq_type', 'composed_type',
    'product_type', 'map_type', 'union_type'
  ].includes(t)
}

export function isPredicateNode(n: unknown): n is PredicateNode {
  return typeof n === 'object' && n !== null && (n as PredicateNode).type === 'predicate'
}

export function isAtomicPredicateNode(n: unknown): n is AtomicPredicateNode {
  if (typeof n !== 'object' || n === null) return false
  const t = (n as { type: string }).type
  return [
    'informal_text', 'boolean_literal', 'not_predicate', 'paren_predicate',
    'quantified', 'relational_expr', 'nil', 'number_literal', 'char_literal',
    'string_literal', 'enum_literal', 'identifier', 'unary_minus', 'binary_op',
    'call', 'field_access', 'index_access', 'if_expr', 'let_expr', 'case_expr',
    'set_expr', 'seq_expr', 'map_expr', 'mk_expr', 'modify_expr', 'paren_expr'
  ].includes(t)
}

export function isFsfSpecNode(n: unknown): n is FsfSpecNode {
  return typeof n === 'object' && n !== null && (n as FsfSpecNode).type === 'fsf_spec'
}

export function isConstDeclNode(n: unknown): n is ConstDeclNode {
  return typeof n === 'object' && n !== null && (n as ConstDeclNode).type === 'const_decl'
}

export function isTypeDeclNode(n: unknown): n is TypeDeclNode {
  return typeof n === 'object' && n !== null && (n as TypeDeclNode).type === 'type_decl'
}

export function isVarDeclNode(n: unknown): n is VarDeclNode {
  return typeof n === 'object' && n !== null && (n as VarDeclNode).type === 'var_decl'
}

export function isInvariantNode(n: unknown): n is InvariantNode {
  return typeof n === 'object' && n !== null && (n as InvariantNode).type === 'invariant'
}

export function isInformalText(n: unknown): boolean {
  return typeof n === 'object' && n !== null && (n as { type: string }).type === 'informal_text'
}
