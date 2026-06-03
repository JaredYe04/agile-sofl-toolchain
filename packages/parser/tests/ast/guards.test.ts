import { describe, it, expect } from 'vitest'
import { check } from '../../src/index'
import {
  isProgramNode,
  isModuleNode,
  isProcessNode,
  isFunctionNode,
  isExpressionNode,
  isTypeExprNode,
  isPredicateNode,
  isAtomicPredicateNode,
  isFsfSpecNode,
  isConstDeclNode,
  isTypeDeclNode,
  isVarDeclNode,
  isInvariantNode,
  isInformalText
} from '../../src/ast/guards'

describe('AST type guards', () => {
  it('recognizes all node kinds in banking fixture', () => {
    const { ast } = check(`module SYSTEM_P;
process P (x: int) y: nat
FSF :
informal note && y > 0 ||
others && y = 0
end_process
function f (x: nat): bool
== undefined
end_function
end_module`)
    expect(isProgramNode(ast)).toBe(true)
    if (!isProgramNode(ast)) return
    const mod = ast.modules[0]
    expect(isModuleNode(mod)).toBe(true)
    expect(isProcessNode(mod.processes[0])).toBe(true)
    expect(isFunctionNode(mod.functions[0])).toBe(true)
    expect(isVarDeclNode({ type: 'not_var' })).toBe(false)
    expect(isConstDeclNode({ type: 'const_decl' })).toBe(true)
    expect(isTypeDeclNode({ type: 'type_decl' })).toBe(true)
    expect(isInvariantNode({ type: 'invariant' })).toBe(true)
    const fsf = mod.processes[0].body?.fsf
    expect(isFsfSpecNode(fsf)).toBe(true)
    const atom = fsf?.scenarios[0]?.test.disjuncts[0]?.atoms[0]
    expect(isInformalText(atom)).toBe(true)
    expect(isPredicateNode(fsf?.scenarios[0]?.test)).toBe(true)
    expect(isAtomicPredicateNode(atom)).toBe(true)
    expect(isExpressionNode({ type: 'binary_op' })).toBe(true)
    expect(isTypeExprNode({ type: 'basic_type' })).toBe(true)
    expect(isProgramNode(null)).toBe(false)
  })
})
