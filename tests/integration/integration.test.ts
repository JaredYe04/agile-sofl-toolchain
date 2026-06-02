import { describe, it, expect } from 'vitest'
import { check } from '../../src/index'
import { loadFixture, expectDiagnostic } from '../helpers/index'

describe('Integration - multi module', () => {
  it('checks parent-child module chain', () => {
    const source = `module SYSTEM_R;
type Base = nat;
end_module;
module Child / R;
type T = Base;
var x: T;
end_module`
    const { diagnostics } = check(source)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })

  it('full pipeline on banking fixture', () => {
    const source = loadFixture('integration/banking.asfl')
    const { diagnostics, ast } = check(source)
    expect(ast).not.toBeNull()
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })
})

describe('Integration - grammar fixtures', () => {
  it('parses minimal module fixture', () => {
    const source = loadFixture('grammar/module/minimal.asfl')
    const { diagnostics } = check(source)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })
})
