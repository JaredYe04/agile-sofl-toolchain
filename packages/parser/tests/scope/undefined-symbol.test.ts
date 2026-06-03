import { describe, it, expect } from 'vitest'
import { check, parseSpecification } from '../../src/index'
import { DiagnosticCodes } from '../../src/diagnostics/codes'

function errorsFor(source: string, code?: string) {
  const { diagnostics } = check(source)
  return diagnostics.filter(
    (d) => d.severity === 'error' && (code === undefined || d.code === code)
  )
}

describe('checkReferences / ASFL_SCOPE_001', () => {
  it('reports undefined var in FSF', () => {
    const errors = errorsFor(
      `module SYSTEM_U;
process P ()
FSF :
others && noSuchSymbol > 0
end_process
end_module`,
      DiagnosticCodes.UNDEFINED_SYMBOL
    )
    expect(errors.length).toBeGreaterThanOrEqual(1)
    expect(errors[0].message).toContain('Undefined')
  })

  it('reports undefined type name', () => {
    const errors = errorsFor(
      `module SYSTEM_U;
var x: MissingType;
end_module`,
      DiagnosticCodes.UNDEFINED_SYMBOL
    )
    expect(errors.some((e) => e.message.includes('Undefined'))).toBe(true)
  })

  it('reports undefined qualified type', () => {
    const errors = errorsFor(
      `module SYSTEM_A;
type T = nat;
end_module;
module B / A;
var x: A.Missing;
end_module`,
      DiagnosticCodes.UNDEFINED_SYMBOL
    )
    expect(errors.length).toBeGreaterThanOrEqual(1)
  })

  it('does not report quantifier binding as undefined', () => {
    const errors = errorsFor(
      `module SYSTEM_P;
var items: set of nat;
inv
forall[i: items] | i > 0;
end_module`,
      DiagnosticCodes.UNDEFINED_SYMBOL
    )
    expect(errors.filter((e) => e.message.includes('Undefined'))).toHaveLength(0)
  })

  it('does not report informal text identifiers', () => {
    const errors = errorsFor(
      `module SYSTEM_P;
process P ()
FSF :
others && informal customer request pending
end_process
end_module`,
      DiagnosticCodes.UNDEFINED_SYMBOL
    )
    expect(errors.filter((e) => e.message.includes('Undefined'))).toHaveLength(0)
  })

  it('does not report declaration names', () => {
    const errors = errorsFor(
      `module SYSTEM_T;
type Foo = nat;
var x: Foo;
end_module`,
      DiagnosticCodes.UNDEFINED_SYMBOL
    )
    expect(errors.filter((e) => e.message.includes('Undefined'))).toHaveLength(0)
  })

  it('does not report function param in body', () => {
    const errors = errorsFor(
      `module SYSTEM_F;
function f (x: nat): nat
== x + 1
end_function
end_module`,
      DiagnosticCodes.UNDEFINED_SYMBOL
    )
    expect(errors.filter((e) => e.message.includes('Undefined'))).toHaveLength(0)
  })

  it('does not report ext rd name in FSF when declared in ext', () => {
    const errors = errorsFor(
      `module SYSTEM_E;
process Worker ()
ext
rd total: int
FSF :
others && total > 0
end_process
end_module`,
      DiagnosticCodes.UNDEFINED_SYMBOL
    )
    expect(errors.filter((e) => e.message.includes('Undefined'))).toHaveLength(0)
  })

  it('reports undefined in const initializer', () => {
    const errors = errorsFor(
      `module SYSTEM_C;
const n = missingVar;
end_module`,
      DiagnosticCodes.UNDEFINED_SYMBOL
    )
    expect(errors.length).toBeGreaterThanOrEqual(1)
  })

  it('integrates with parseSpecification pipeline', () => {
    const { diagnostics } = parseSpecification(
      `module SYSTEM_X;
process P ()
FSF :
others && ghost > 0
end_process
end_module`
    )
    expect(diagnostics.some((d) => d.code === DiagnosticCodes.UNDEFINED_SYMBOL)).toBe(true)
  })
})
