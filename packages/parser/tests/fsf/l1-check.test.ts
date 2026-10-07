import { describe, it, expect } from 'vitest'
import { check } from '../../src/index'

const wrap = (proc: string, decls = '') => `module SYSTEM_L1;\n${decls}\n${proc}\nend_module.`
const l1 = (src: string, opts?: any) => check(src, opts).diagnostics.filter((d) => /^ASFL_FSF_10/.test(d.code))
const codes = (src: string) => l1(src).map((d) => `${d.code}:${d.severity}`)

describe('L1 FSF static check', () => {
  it('grammar l.882 example passes', () => {
    expect(codes(wrap(`process A (x,y: int) q1: nat, q2 : int, q3 : int
ext rd a : int
    wr b : nat
FSF :
 x > y && q1 > q2 + q3 ||
 x = y && q1 > q2 * q3 ||
 others && q1 = q2 + q3
end_process ;`))).toEqual([])
  })

  it('reports an output variable in T as error', () => {
    const d = l1(wrap(`process P (x: int) r: int
FSF :
 x > 0 and r > 0 && r = 1 ||
 others && r = 0
end_process ;`))
    expect(d.map((x) => x.code)).toEqual(['ASFL_FSF_101'])
    expect(d[0].severity).toBe('error')
    expect(d[0].message).toContain("'r'")
  })

  it('reports D without output variable as error (also in others branch)', () => {
    expect(codes(wrap(`process P (x: int) r: int
FSF :
 x > 0 && x = x ||
 others && true
end_process ;`))).toEqual(['ASFL_FSF_102:error', 'ASFL_FSF_102:error'])
  })

  it('allows ~x in T; wr var and ~ext var in D count as output', () => {
    expect(codes(wrap(`process Register_Stock(stock: nat) res: bool
ext wr stock_list: seq of nat
FSF:
  stock notin elems(~stock_list) && stock_list = conc(~stock_list, [stock]) and res = true
||
  stock inset elems(~stock_list) && stock_list = ~stock_list and res = false
end_process`, 'var ext stock_list: seq of nat;'))).toEqual([])
    // D mentions only ~rd external variable -> counts as output (team rule)
    expect(codes(wrap(`process Q (x: int) r: int
ext rd a: int
FSF :
 x > 0 && ~a > 0 ||
 others && r = 0
end_process ;`, 'var a: int;'))).toEqual([])
  })

  it('warns on plain wr variable in T (final value)', () => {
    expect(codes(wrap(`process W () r: int
ext wr b: int
FSF :
 b > 0 && b = 0 and r = 1 ||
 others && r = 0
end_process ;`, 'var b: int;'))).toEqual(['ASFL_FSF_104:warning'])
  })

  it('natural-language atoms: skip with warning, never error', () => {
    const d = l1(wrap(`process Login (pwd: string) ok: bool
FSF :
 pwd is correct && the user is logged in ||
 others && ok = false
end_process ;`))
    expect(d.every((x) => x.severity === 'warning')).toBe(true)
    expect(d.map((x) => x.code)).toEqual(['ASFL_FSF_103', 'ASFL_FSF_103'])
  })

  it('quantifier-bound names are not treated as outputs', () => {
    expect(codes(wrap(`process F (s: set of int) r: bool
FSF :
 forall[r: s] | r > 0 && r = true ||
 others && r = false
end_process ;`))).toEqual([])
  })

  it('can be disabled with fsfL1: false', () => {
    expect(l1(wrap(`process P (x: int) r: int
FSF :
 r > 0 && x = 1
end_process ;`), { fsfL1: false })).toEqual([])
  })
})
