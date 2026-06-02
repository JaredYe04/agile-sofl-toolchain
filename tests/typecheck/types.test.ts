import { describe, it, expect } from 'vitest'
import { check, parse, parseModule } from '../../src/index'
import {
  typeExprToInternal,
  typesCompatible,
  typeToString
} from '../../src/typecheck/types'
import { isProgramNode } from '../../src/ast/guards'

describe('Internal type conversion', () => {
  it('converts all type expression shapes', () => {
    const source = `module SYSTEM_T;
type
S = set of nat;
Q = seq of int;
P = nat * int;
M = map nat to bool;
U = nat | int;
E = {<a>, <b>};
C = composed of x: nat y: int end;
L = Local;
end_module`
    const ast = check(source).ast
    expect(ast).not.toBeNull()
    if (isProgramNode(ast)) {
      const types = ast.modules[0].types
      expect(typeToString(typeExprToInternal(types[0].typeExpr))).toContain('set of')
      expect(typeToString(typeExprToInternal(types[1].typeExpr))).toContain('seq of')
      expect(typeToString(typeExprToInternal(types[2].typeExpr))).toContain('*')
      expect(typeToString(typeExprToInternal(types[3].typeExpr))).toContain('map')
      expect(typeExprToInternal(types[4].typeExpr).kind).toBe('union')
      expect(typeExprToInternal(types[5].typeExpr).kind).toBe('enum')
      expect(typeExprToInternal(types[6].typeExpr).kind).toBe('composed')
      expect(typeExprToInternal(types[7].typeExpr).kind).toBe('named')
    }
  })

  it('checks type compatibility for products and enums', () => {
    const p1 = typeExprToInternal({
      type: 'product_type',
      span: { start: 0, end: 0, line: 1, column: 1 },
      elements: [
        { type: 'basic_type', span: { start: 0, end: 0, line: 1, column: 1 }, name: 'nat' },
        { type: 'basic_type', span: { start: 0, end: 0, line: 1, column: 1 }, name: 'int' }
      ]
    })
    const p2 = { ...p1 }
    expect(typesCompatible(p1, p2)).toBe(true)
    const e1 = typeExprToInternal({
      type: 'enum_type',
      span: { start: 0, end: 0, line: 1, column: 1 },
      values: ['a', 'b']
    })
    expect(typesCompatible(e1, e1)).toBe(true)
  })

  it('handles universal union type', () => {
    const u = typeExprToInternal({
      type: 'union_type',
      span: { start: 0, end: 0, line: 1, column: 1 },
      variants: [],
      isUniversal: true
    })
    expect(u.kind).toBe('union')
    expect(typeToString(u)).toBe('unknown')
  })
})

describe('Parse error paths', () => {
  it('returns lex diagnostics for invalid characters', () => {
    const { ast, diagnostics } = parse('module @bad')
    expect(ast).toBeNull()
    expect(diagnostics.some((d) => d.code === 'ASFL_LEX_001')).toBe(true)
  })

  it('parseModule reports lex errors', () => {
    const { ast, diagnostics } = parseModule('module @bad')
    expect(ast).toBeNull()
    expect(diagnostics.length).toBeGreaterThan(0)
  })
})
