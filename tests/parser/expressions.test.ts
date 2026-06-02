import { describe, it, expect } from 'vitest'
import { parse } from '../../src/index'
import { expectParseOk } from '../helpers/index'
import { isProgramNode } from '../../src/ast/guards'

describe('Parser - expressions', () => {
  it('respects operator precedence', () => {
    const source = `module SYSTEM_E;
const v = 1 + 2 * 3;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      const v = ast.modules[0].consts[0].value
      expect(v.type).toBe('binary_op')
      if (v.type === 'binary_op') {
        expect(v.op).toBe('+')
        expect(v.right.type).toBe('binary_op')
      }
    }
  })

  it('parses power operator', () => {
    const source = `module SYSTEM_E;
const v = 2 ** 3;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].consts[0].value.type).toBe('binary_op')
    }
  })

  it('parses inset and notin', () => {
    const source = `module SYSTEM_E;
var x: set of nat;
inv x inset {1, 2} and x notin {3};
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].invariants).toHaveLength(1)
    }
  })

  it('parses quantifier in invariant', () => {
    const source = `module SYSTEM_E;
var items: set of nat;
inv forall[i: items] | i > 0;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      const inv = ast.modules[0].invariants[0]
      expect(inv.condition.disjuncts[0].atoms[0].type).toBe('quantified')
    }
  })

  it('parses if expression in const', () => {
    const source = `module SYSTEM_E;
const v = if x > 0 then 1 else 0;
var x: nat;
end_module`
    const { diagnostics } = parse(source)
    expect(diagnostics.filter((d) => d.severity === 'error').length).toBeLessThanOrEqual(1)
  })

  it('parses let expression', () => {
    const source = `module SYSTEM_E;
const v = let x = 1 in x + 1;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].consts[0].value.type).toBe('let_expr')
    }
  })

  it('parses field access', () => {
    const source = `module SYSTEM_E;
var c: composed of f: nat end;
inv c.f > 0;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].invariants).toHaveLength(1)
    }
  })

  it('parses empty set and seq', () => {
    const source = `module SYSTEM_E;
const s = {}; q = [];
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].consts[0].value.type).toBe('set_expr')
      expect(ast.modules[0].consts[1].value.type).toBe('seq_expr')
    }
  })

  it('parses nil literal', () => {
    const source = `module SYSTEM_E;
const n = nil;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].consts[0].value.type).toBe('nil')
    }
  })
})

describe('Parser - module boundaries', () => {
  it('parses empty module body', () => {
    const source = `module SYSTEM_E;
end_module`
    expectParseOk(source, parse)
  })

  it('parses module with only variables', () => {
    const source = `module SYSTEM_E;
var a: nat; b: int;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].vars).toHaveLength(2)
    }
  })

  it('fails gracefully on unclosed module', () => {
    const { diagnostics } = parse('module SYSTEM_E; var x: nat;')
    expect(diagnostics.some((d) => d.severity === 'error')).toBe(true)
  })
})
