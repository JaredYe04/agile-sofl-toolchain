import { describe, it, expect } from 'vitest'
import { check, parseSpecification } from '../../src/index'
import { loadFixture, expectDiagnostic } from '../helpers/index'
import { isProgramNode } from '../../src/ast/guards'

describe('Scope resolver', () => {
  it('resolves module hierarchy', () => {
    const source = loadFixture('integration/banking.asfl')
    const { ast, diagnostics } = check(source)
    expect(ast).not.toBeNull()
    expect(diagnostics.filter((d) => d.severity === 'error' && d.code.startsWith('ASFL_SCOPE'))).toHaveLength(0)
  })

  it('detects duplicate module names', () => {
    const source = `module SYSTEM_A;
end_module;
module SYSTEM_A;
end_module`
    const { diagnostics } = parseSpecification(source)
    expect(expectDiagnostic(diagnostics, 'ASFL_SCOPE_002')).toBe(true)
  })
})

describe('Type checker', () => {
  it('checks variable types', () => {
    const source = `module SYSTEM_T;
var x: nat;
end_module`
    const { diagnostics } = check(source)
    expect(diagnostics.filter((d) => d.code === 'ASFL_TYPE_001')).toHaveLength(0)
  })
})

describe('FSF classifier', () => {
  it('warns on informal bottom process', () => {
    const source = `module SYSTEM_P;
process P ()
FSF :
informal text && y = 1
end_process
end_module`
    const { diagnostics } = check(source)
    expect(expectDiagnostic(diagnostics, 'ASFL_FSF_001')).toBe(true)
  })

  it('info on missing others branch', () => {
    const source = `module SYSTEM_P;
process P (x: int) y: nat
FSF :
x > 0 && y > 0
end_process
end_module`
    const { diagnostics } = check(source)
    expect(expectDiagnostic(diagnostics, 'ASFL_FSF_003')).toBe(true)
  })
})

describe('Full check pipeline', () => {
  it('check() runs parse + scope + types + fsf', () => {
    const source = loadFixture('grammar/module/minimal.asfl')
    const { ast, diagnostics } = check(source)
    expect(ast).not.toBeNull()
    expect(isProgramNode(ast)).toBe(true)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })
})
