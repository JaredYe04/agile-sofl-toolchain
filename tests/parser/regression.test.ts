import { describe, it, expect } from 'vitest'
import { parse } from '../../src/index'
import { tokenize } from '../../src/lexer/lexer'
import { isProgramNode } from '../../src/ast/guards'

describe('Parser regression - user reported cases', () => {
  it('parses total as identifier in process signature', () => {
    const source = `module SYSTEM_E;
process Checkout (customer: nat, total: nat) receipt: nat
FSF :
others && total = 0
end_process
end_module`
    const { ast, diagnostics } = parse(source)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    if (isProgramNode(ast)) {
      const proc = ast.modules[0].processes[0]
      const inputNames = proc.inputs.flatMap((g) => g.names)
      expect(inputNames).toContain('total')
    }
  })

  it('lexes comment informal line without splitting in', () => {
    const line = 'comment: informal add product when customer is active'
    const images = tokenize(line).tokens.map((t) => t.image)
    expect(images).toContain('informal')
    expect(images.filter((i) => i === 'in')).toHaveLength(0)
  })

  it('parses ecommerce-style comment on process', () => {
    const source = `module SYSTEM_E;
process P ()
FSF :
others && true
comment: informal add product when customer is active
end_process
end_module`
    const { ast, diagnostics } = parse(source)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].processes[0].body?.comment).toContain('informal')
    }
  })

  it('parses map type with to keyword', () => {
    const source = `module SYSTEM_T;
type M = map string to nat;
end_module`
    const { ast, diagnostics } = parse(source)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].types[0].typeExpr.type).toBe('map_type')
    }
  })
})
