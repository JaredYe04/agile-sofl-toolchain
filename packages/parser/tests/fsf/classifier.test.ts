import { describe, it, expect } from 'vitest'
import { check } from '../../src/index'
import { expectDiagnostic } from '../helpers/index'

describe('FSF classifier details', () => {
  it('classifies formal FSF without warnings', () => {
    const source = `module SYSTEM_P;
process P (x: int) y: nat
FSF :
x > 0 && y > 0 ||
others && y = 0
end_process
end_module`
    const { diagnostics } = check(source)
    expect(expectDiagnostic(diagnostics, 'ASFL_FSF_001')).toBe(false)
  })

  it('detects semi-formal test with informal atom', () => {
    const source = `module SYSTEM_P;
process P ()
FSF :
informal precondition && y = 1 ||
others && y = 0
end_process
end_module`
    const { diagnostics } = check(source)
    expect(diagnostics.some((d) => d.code.startsWith('ASFL_FSF'))).toBe(true)
  })

  it('checks ext read-only variable usage', () => {
    const source = `module SYSTEM_P;
var a: int;
process P ()
ext
rd a: int
FSF :
true && a = 1
end_process
end_module`
    const { diagnostics } = check(source)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })
})

describe('Scope visibility', () => {
  it('child module references parent type', () => {
    const source = `module SYSTEM_R;
type Item = nat;
end_module;
module Child / R;
var x: Item;
end_module`
    const { diagnostics } = check(source)
    expect(diagnostics.filter((d) => d.code === 'ASFL_SCOPE_001')).toHaveLength(0)
  })
})

describe('Type expressions', () => {
  it('accepts product and map types in variables', () => {
    const source = `module SYSTEM_T;
type
Pair = nat * int;
M = map nat to bool;
var p: Pair; m: M;
end_module`
    const { diagnostics } = check(source)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })

  it('accepts if expression in function body', () => {
    const source = `module SYSTEM_T;
function f (x: nat): nat
== if x > 0 then x else 0
end_function
end_module`
    const { diagnostics } = check(source)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })
})
