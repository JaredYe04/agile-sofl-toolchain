import { describe, it, expect } from 'vitest'
import { parse, parseStrict } from '../../src/index.js'
import { isProgramNode } from '../../src/ast/guards.js'
import { loadFixture } from '../helpers/index.js'

/**
 * Regression fixtures for the ASMSR specimen-validator role.
 *
 * These are the reference `hybrid_sofl` representations produced by the reverse agent
 * for the kanboard / miniflux / smoke_kvstore benchmarks, plus the grammar's own
 * `SYSTEM_Banking` example (Liu 2026) with an `FSF :` process, `decom:` / `comment:`,
 * and the `module ... / SYSTEM_Parent;` decomposition hierarchy. Each must parse as
 * valid Agile-SOFL with zero error diagnostics.
 */
const REFERENCE_FIXTURES = [
  'reference/kanboard_hybrid_sofl.asfl',
  'reference/miniflux_hybrid_sofl.asfl',
  'reference/kvstore_hybrid_sofl.asfl'
]

describe('reference hybrid specs parse valid', () => {
  for (const rel of REFERENCE_FIXTURES) {
    it(`${rel} parses cleanly (tolerant)`, () => {
      const { ast, diagnostics } = parse(loadFixture(rel))
      expect(isProgramNode(ast)).toBe(true)
      expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    })

    it(`${rel} parses cleanly (strict)`, () => {
      const { ast, diagnostics } = parseStrict(loadFixture(rel))
      expect(ast).not.toBeNull()
      expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    })
  }

  it('SYSTEM_Banking grammar example parses cleanly (strict)', () => {
    const rel = 'grammar/modules/system-banking-hierarchy.asfl'
    const { ast, diagnostics } = parseStrict(loadFixture(rel))
    expect(ast).not.toBeNull()
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    if (ast?.type === 'program') {
      const names = ast.modules.map((m) => m.name)
      expect(names).toContain('Banking')
      expect(names).toContain('Banking_Decom')
      expect(names).toContain('D')
      // SYSTEM_-prefixed top module referenced as a child's parent must resolve.
      const child = ast.modules.find((m) => m.name === 'Banking_Decom')
      expect(child?.parent?.name).toBe('SYSTEM_Banking')
      const d = ast.modules.find((m) => m.name === 'D')
      expect(d?.parent?.name).toBe('Banking_Decom')
    }
  })

  it('comment text accepts reserved words used as prose (module, decom, process)', () => {
    const src = `module SYSTEM_C;
process Withdraw (amount: int) cash: nat
pre
    amount > 0
post
    cash = amount
comment: the module commits and a process maps results end to end
end_process
end_module`
    const { ast, diagnostics } = parseStrict(src)
    expect(ast).not.toBeNull()
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })
})