import { describe, it, expect } from 'vitest'
import { check } from '../../src/index'

const mk = (fsf: string) => `module SYSTEM_T;
type Id = nat;
var orders: map Id to nat;
process P(x: Id, y: Id) ok: bool
ext wr orders
FSF:
${fsf}
end_process
end_module.`
const codes = (fsf: string) => check(mk(fsf)).diagnostics.filter((d) => d.severity === 'error').map((d) => d.code)

describe('L1 fixes from fault injection', () => {
  it('F1: ~ext alone does not constrain an output (102)', () => {
    expect(codes(`  x <= 10 && x = card(dom(~orders))\n||\n  x > 10 && orders = ~orders and ok = false`)).toContain('ASFL_FSF_102')
    expect(codes(`  x <= 10 && orders = ~orders and ok = true\n||\n  x > 10 && orders = ~orders and ok = false`)).toEqual([])
  })
  it('F2: ~ on a non-ext variable is an L1 error (105)', () => {
    expect(codes(`  ~x <= 10 && orders = ~orders and ok = true\n||\n  others && orders = ~orders and ok = false`)).toContain('ASFL_FSF_105')
    expect(codes(`  x <= 10 && orders = ~orders and ~y > 1 and ok = true\n||\n  others && orders = ~orders and ok = false`)).toContain('ASFL_FSF_105')
    expect(codes(`  x inset dom(~orders) && orders = ~orders and ok = true\n||\n  others && orders = ~orders and ok = false`)).toEqual([])
  })
})
