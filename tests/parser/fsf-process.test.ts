import { describe, it, expect } from 'vitest'
import { parse } from '../../src/index'
import { textOf } from '../../src/ast/nodes'
import { expectParseOk, expectDiagnostic } from '../helpers/index'
import { isProgramNode } from '../../src/ast/guards'

describe('Parser - FSF and processes', () => {
  it('parses FSF with only others branch', () => {
    const source = `module SYSTEM_P;
process P ()
FSF :
others && true
end_process
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].processes[0].body?.fsf?.others).toBeDefined()
      expect(ast.modules[0].processes[0].body?.fsf?.scenarios).toHaveLength(0)
    }
  })

  it('parses multiple FSF scenarios plus others', () => {
    const source = `module SYSTEM_P;
process P (x: int) y: nat
FSF :
x > 0 && y > 0 ||
x = 0 && y = 0 ||
others && y = 1
end_process
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      const fsf = ast.modules[0].processes[0].body?.fsf
      expect(fsf?.scenarios).toHaveLength(2)
      expect(fsf?.others).toBeDefined()
    }
  })

  it('parses informal text in FSF', () => {
    const source = `module SYSTEM_P;
process P ()
FSF :
informal requirement && y = 1
end_process
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      const atom = ast.modules[0].processes[0].body?.fsf?.scenarios[0]?.test.disjuncts[0]?.atoms[0]
      expect(atom?.type).toBe('informal_text')
    }
  })

  it('parses process with dual param lists', () => {
    const source = `module SYSTEM_P;
process P (a, b: int) c: nat, d: int
FSF :
true && a = c
end_process
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      const p = ast.modules[0].processes[0]
      expect(p.inputs.length).toBeGreaterThan(0)
      expect(p.outputs.length).toBeGreaterThan(0)
    }
  })

  it('parses process alias', () => {
    const source = `module SYSTEM_P;
process Copy equal Other.P
end_process
end_module;
module Other / P;
process P ()
FSF :
true && true
end_process
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].processes[0].alias?.name).toBe('P')
    }
  })

  it('parses function with undefined body', () => {
    const source = `module SYSTEM_F;
function f (x: nat): bool
== undefined
end_function
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].functions[0].isUndefined).toBe(true)
    }
  })

  it('parses decom and comment on process', () => {
    const source = `module SYSTEM_P;
process P ()
FSF :
true && true
decom: RefinementDiagram
comment: informal note here
end_process
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      const body = ast.modules[0].processes[0].body
      expect(textOf(body?.decomposition)).toBe('RefinementDiagram')
      expect(textOf(body?.comment)).toContain('informal')
    }
  })
})

describe('FSF classifier integration', () => {
  it('warns on informal bottom process via check', () => {
    const source = `module SYSTEM_P;
process P ()
FSF :
informal text && y = 1
end_process
end_module`
    const { diagnostics } = parse(source)
    expect(expectDiagnostic(diagnostics, 'ASFL_FSF_001')).toBe(false)
  })
})
