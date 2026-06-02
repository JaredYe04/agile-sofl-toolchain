import { describe, it, expect } from 'vitest'
import { check } from '../../src/index'
import { loadFixture, expectDiagnostic } from '../helpers/index'

describe('Type checker', () => {
  it('accepts valid variable declarations', () => {
    const source = `module SYSTEM_T;
var x: nat; y: int;
end_module`
    const { diagnostics } = check(source)
    expect(diagnostics.filter((d) => d.code === 'ASFL_TYPE_001')).toHaveLength(0)
  })

  it('checks banking fixture without type errors', () => {
    const source = loadFixture('integration/banking.asfl')
    const { diagnostics } = check(source)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })
})

describe('Scope checker', () => {
  it('detects duplicate module names', () => {
    const source = `module SYSTEM_A;
end_module;
module SYSTEM_A;
end_module`
    const { diagnostics } = check(source)
    expect(expectDiagnostic(diagnostics, 'ASFL_SCOPE_002')).toBe(true)
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
