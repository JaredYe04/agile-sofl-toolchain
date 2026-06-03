import { describe, it, expect } from 'vitest'
import { parse, parseModule } from '../../src/index'
import { loadFixture, expectParseOk } from '../helpers/index'
import { isProgramNode, isModuleNode } from '../../src/ast/guards'

describe('Parser - modules', () => {
  it('parses minimal system module', () => {
    const source = loadFixture('grammar/module/minimal.asfl')
    const { ast, diagnostics } = parse(source)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    expect(ast).not.toBeNull()
    expect(isProgramNode(ast)).toBe(true)
    if (isProgramNode(ast)) {
      expect(ast.modules).toHaveLength(1)
      expect(ast.modules[0].isSystem).toBe(true)
      expect(ast.modules[0].name).toBe('Test')
    }
  })

  it('parseModule parses single module', () => {
    const source = `module Foo;
var x: nat;
end_module`
    const { ast } = parseModule(source)
    expect(ast).not.toBeNull()
    expect(isModuleNode(ast)).toBe(true)
    if (isModuleNode(ast)) {
      expect(ast.name).toBe('Foo')
      expect(ast.vars).toHaveLength(1)
    }
  })

  it('parses const and type declarations', () => {
    const source = `module SYSTEM_T;
const a = 1; b = 2;
type S = set of nat; T = int;
var x: S;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].consts.length).toBeGreaterThanOrEqual(1)
      expect(ast.modules[0].types.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('parses submodule with parent', () => {
    const source = `module SYSTEM_R;
end_module;
module Child / R;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules).toHaveLength(2)
      expect(ast.modules[1].parent?.name).toBe('R')
    }
  })
})

describe('Parser - expressions', () => {
  it('parses numeric expressions', () => {
    const source = `module SYSTEM_E;
const v = 1 + 2 * 3;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].consts[0].value.type).toBe('binary_op')
    }
  })

  it('parses set and seq literals', () => {
    const source = `module SYSTEM_E;
const s = {1, 2, 3}; q = [1, 2];
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].consts[0].value.type).toBe('set_expr')
      expect(ast.modules[0].consts[1].value.type).toBe('seq_expr')
    }
  })

  it('parses relational expressions in inv', () => {
    const source = `module SYSTEM_E;
var x: nat;
inv x > 0 and x <> 10;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].invariants).toHaveLength(1)
    }
  })
})

describe('Parser - process and FSF', () => {
  it('parses process with FSF scenarios', () => {
    const source = `module SYSTEM_P;
process P (x: int) y: nat
FSF :
x > 0 && y > 0 ||
others && y = 0
end_process
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      const proc = ast.modules[0].processes[0]
      expect(proc.body?.fsf?.scenarios).toHaveLength(1)
      expect(proc.body?.fsf?.others).toBeDefined()
    }
  })

  it('parses ext rd/wr variables', () => {
    const source = `module SYSTEM_P;
process P ()
ext
rd a: int
wr b: nat
FSF :
true && b = 1
end_process
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].processes[0].body?.ext).toHaveLength(2)
    }
  })
})

describe('Integration - banking', () => {
  it('parses banking fixture', () => {
    const source = loadFixture('integration/banking.asfl')
    const { ast, diagnostics } = parse(source)
    const errors = diagnostics.filter((d) => d.severity === 'error')
    if (errors.length > 0) {
      console.log(errors)
    }
    expect(errors).toHaveLength(0)
    expect(ast).not.toBeNull()
    if (isProgramNode(ast)) {
      expect(ast.modules[0].name).toBe('Banking')
      expect(ast.modules[0].processes[0].name).toBe('A')
      expect(ast.modules[0].processes[0].body?.fsf?.scenarios.length).toBe(2)
    }
  })
})
