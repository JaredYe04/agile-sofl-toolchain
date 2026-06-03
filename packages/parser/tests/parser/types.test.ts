import { describe, it, expect } from 'vitest'
import { parse } from '../../src/index'
import { expectParseOk } from '../helpers/index'
import { isProgramNode } from '../../src/ast/guards'

describe('Parser - types', () => {
  it('parses set and seq types', () => {
    const source = `module SYSTEM_T;
type S = set of nat; Q = seq of int;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].types[0].typeExpr.type).toBe('set_type')
      expect(ast.modules[0].types[1].typeExpr.type).toBe('seq_type')
    }
  })

  it('parses composed type', () => {
    const source = `module SYSTEM_T;
type Person = composed of
  name: string
  age: nat
end;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].types[0].typeExpr.type).toBe('composed_type')
    }
  })

  it('parses product type', () => {
    const source = `module SYSTEM_T;
type Pair = nat * int;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].types[0].typeExpr.type).toBe('product_type')
    }
  })

  it('parses map type', () => {
    const source = `module SYSTEM_T;
type M = map nat to bool;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].types[0].typeExpr.type).toBe('map_type')
    }
  })

  it('parses union type', () => {
    const source = `module SYSTEM_T;
type U = nat | int;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].types[0].typeExpr.type).toBe('union_type')
    }
  })

  it('parses universal type', () => {
    const source = `module SYSTEM_T;
type U = universal;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].types[0].typeExpr.type).toBe('union_type')
    }
  })

  it('parses enum type', () => {
    const source = `module SYSTEM_T;
type Color = {<red>, <green>, <blue>};
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].types[0].typeExpr.type).toBe('enum_type')
    }
  })

  it('parses parent type reference', () => {
    const source = `module SYSTEM_T;
type Local / Parent.Base = nat;
end_module;
module Parent / T;
type Base = nat;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].types[0].parentType?.name).toBe('Base')
    }
  })
})
