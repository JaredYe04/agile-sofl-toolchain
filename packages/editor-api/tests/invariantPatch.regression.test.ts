import { describe, expect, it } from 'vitest'

import { parse } from '@agile-sofl/parser'

import {
  addInvariant,
  removeInvariantByIndex,
  removeInvariantInModule
} from '../src/invariantPatch.js'



const RISK_TAIL = `module RiskControl;

type

  RiskConfig = max_single_ratio: real;

var

  Config: RiskConfig;

inv

    下单金额不得超过账户可用资金。;

    仅允许在美股交易时段内提交订单。;

process CheckRisk (user_id: nat) ok: bool

    pre

        true

    post

        true

end_process

end_module`



describe('invariantPatch regression', () => {

  it('add two default predicates then remove one keeps parseable module', () => {

    let source = RISK_TAIL

    source = addInvariant(source, 'RiskControl', '1 <= 1') ?? source

    source = addInvariant(source, 'RiskControl', '2 <= 2') ?? source

    const { ast: ast1 } = parse(source)

    expect(ast1?.type).toBe('program')

    const mod1 = ast1!.modules.find((m) => m.name === 'RiskControl')!

    expect(mod1.invariants.length).toBe(4)

    const spans = mod1.invariants.map((inv) => ({ ...inv.span }))

    expect(new Set(spans.map((s) => s.start)).size).toBe(4)



    const removeIdx = mod1.invariants.findIndex((inv) => {

      const t = source.slice(inv.span.start, inv.span.end).trim()

      return t === '1 <= 1' || t === '1 <= 1;'

    })

    expect(removeIdx).toBeGreaterThanOrEqual(0)

    source = removeInvariantInModule(source, 'RiskControl', spans[removeIdx]!)



    const { ast: ast2, diagnostics } = parse(source)

    expect(ast2?.type).toBe('program')

    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)

    expect(source).toMatch(/end_module/)

    const mod2 = ast2!.modules.find((m) => m.name === 'RiskControl')!

    expect(mod2.invariants.length).toBe(3)

  })



  it('does not corrupt module when const block exists after inv (non-canonical order)', () => {
    const source = `module M;
type T = nat;
inv
  x > 0;
const
  NewConst = 0;
end_module`
    let next = addInvariant(source, 'M', '1 <= 1') ?? source
    next = addInvariant(next, 'M', '2 <= 2') ?? next
    const { ast, diagnostics: d1 } = parse(next)
    expect(d1.filter((d) => d.severity === 'error')).toHaveLength(0)
    const mod = ast!.modules.find((m) => m.name === 'M')!
    const lastAdded = mod.invariants[mod.invariants.length - 1]!
    next = removeInvariantInModule(next, 'M', lastAdded.span)
    const again = parse(next)
    expect(again.ast?.type).toBe('program')
    expect(next).toMatch(/end_module/)
    expect(next).toContain('NewConst')
    expect(again.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })

  it('removeByIndex removes the same line as span-based remove', () => {
    let source = RISK_TAIL
    source = addInvariant(source, 'RiskControl', '1 <= 1') ?? source
    source = addInvariant(source, 'RiskControl', '2 <= 2') ?? source
    const { ast } = parse(source)
    const mod = ast!.modules.find((m) => m.name === 'RiskControl')!
    const idx = mod.invariants.length - 1
    const byIndex = removeInvariantByIndex(source, 'RiskControl', idx)
    const bySpan = removeInvariantInModule(source, 'RiskControl', mod.invariants[idx]!.span)
    expect(byIndex).toBe(bySpan)
  })

})


