import { describe, it, expect } from 'vitest'
import { checkAsync } from '../../src/index'

const mod = (body: string, decls = '') => `module SYSTEM_L2;\n${decls}\n${body}\nend_module.`
async function l2(src: string, opts: any = {}) {
  const r = await checkAsync(src, opts)
  const parseErr = r.diagnostics.filter((d) => /PARSE|LEX/.test(d.code))
  expect(parseErr).toEqual([])
  return r.diagnostics.filter((d) => /^ASFL_FSF_2/.test(d.code))
}
const codes = (ds: any[]) => ds.map((d) => d.code).sort()

describe('L2 Z3 FSF check (mapping spec T01-T16)', () => {
  it('T01 grammar l.882 example: exclusive; complete by others', async () => {
    const d = await l2(mod(`process A (x,y: int) q1: nat, q2 : int, q3 : int
ext rd a : int
    wr b : nat
FSF :
 x > y && q1 > q2 + q3 ||
 x = y && q1 > q2 * q3 ||
 others && q1 = q2 + q3
end_process ;`))
    expect(codes(d)).toEqual(['ASFL_FSF_209'])
  }, 30000)

  it('T02 grammar l.891 process B is an ellipsis placeholder, not parseable FSF (documented, not run)', () => {
    expect(true).toBe(true)
  })

  it('T03 l.882 without others: incomplete with counterexample', async () => {
    const d = await l2(mod(`process A (x,y: int) q1: nat, q2 : int, q3 : int
FSF :
 x > y && q1 > q2 + q3 ||
 x = y && q1 > q2 * q3
end_process ;`))
    expect(codes(d)).toEqual(['ASFL_FSF_202'])
    expect(d[0]!.severity).toBe('error')
    expect(d[0]!.message).toMatch(/x = -?\d+, y = -?\d+/)
  }, 30000)

  it('T04 three-way split: exclusive and complete', async () => {
    expect(await l2(mod(`process Cmp (x, y: int) r: int
FSF :
 x > y && r = 1 ||
 x = y && r = 0 ||
 x < y && r = -1
end_process ;`))).toEqual([])
  }, 30000)

  it('T05 overlap reported with counterexample', async () => {
    const d = await l2(mod(`process Grade (s: nat0) g: int
FSF :
 s >= 60 && g = 1 ||
 s >= 90 && g = 2 ||
 s < 60 && g = 0
end_process ;`))
    expect(codes(d)).toEqual(['ASFL_FSF_201'])
    expect(d[0]!.message).toContain('scenarios 1 and 2')
    expect(d[0]!.message).toMatch(/s = (9\d|\d{3,})/)
  }, 30000)

  it('T06 nat0 axiom makes it complete; int is incomplete (n = -1)', async () => {
    const f = (t: string) => mod(`process Sign (n: ${t}) z: bool
FSF :
 n = 0 && z = true ||
 n > 0 && z = false
end_process ;`)
    expect(await l2(f('nat0'))).toEqual([])
    const d = await l2(f('int'))
    expect(codes(d)).toEqual(['ASFL_FSF_202'])
    expect(d[0]!.message).toMatch(/n = -\d+/)
  }, 30000)

  it('T07 nat >= 1', async () => {
    expect(await l2(mod(`process P (n: nat) r: int
FSF :
 n >= 1 && r = n
end_process ;`))).toEqual([])
  }, 30000)

  it('T08 DNF test conditions + enumeration', async () => {
    expect(await l2(mod(`process Fee (lv: Level, amt: nat0) fee: nat0
FSF :
 lv = <Gold> or lv = <Silver> && fee = 0 ||
 lv = <Normal> and amt >= 1000 && fee = 0 ||
 lv = <Normal> and amt < 1000 && fee = 5
end_process ;`, 'type Level = {<Gold>, <Silver>, <Normal>};'))).toEqual([])
  }, 30000)

  it('T09 old state ~x with set and elems', async () => {
    expect(await l2(mod(`process Register_Stock (id: nat) ok: bool
ext wr stock: set of nat
    rd log: seq of nat
FSF :
 id inset ~stock && ok = false ||
 id notin ~stock and id inset elems(log) && ok = true and stock = union(~stock, {id}) ||
 id notin ~stock and id notin elems(log) && ok = false
end_process ;`, 'var stock: set of nat;\n log: seq of nat;'))).toEqual([])
  }, 30000)

  it('T10 map and dom (Card style)', async () => {
    expect(await l2(mod(`process Card_Pay (cid: nat, amt: nat) ok: bool
ext wr cards: map nat to nat0
FSF :
 cid notin dom(~cards) && ok = false ||
 cid inset dom(~cards) and ~cards(cid) >= amt && ok = true and cards = override(~cards, {cid -> ~cards(cid) - amt}) ||
 cid inset dom(~cards) and ~cards(cid) < amt && ok = false
end_process ;`, 'var cards: map nat to nat0;'))).toEqual([])
  }, 30000)

  it('T11 sequence len/hd overlap', async () => {
    const d = await l2(mod(`process Head (s: seq of int) r: int
FSF :
 len(s) = 0 && r = 0 ||
 len(s) >= 1 and hd(s) > 0 && r = 1 ||
 len(s) >= 1 && r = 2
end_process ;`))
    expect(codes(d)).toEqual(['ASFL_FSF_201'])
    expect(d[0]!.message).toContain('scenarios 2 and 3')
  }, 30000)

  it('T12 quantifiers -> unsupported warnings, never error', async () => {
    const d = await l2(mod(`process AllPos (s: set of int) r: bool
FSF :
 forall[x: s] | x > 0 && r = true ||
 exists[x: s] | x <= 0 && r = false
end_process ;`))
    expect(d.length).toBeGreaterThan(0)
    expect(d.every((x) => x.severity === 'warning' && x.code === 'ASFL_FSF_205')).toBe(true)
  }, 30000)

  it('T13 natural-language atoms: by others = pass; without others -> 206 warnings only', async () => {
    expect(codes(await l2(mod(`process Login (pwd: string) ok: bool
FSF :
 pwd is correct && ok = true ||
 others && ok = false
end_process ;`)))).toEqual(['ASFL_FSF_209'])
    const d = await l2(mod(`process Login (pwd: string) ok: bool
FSF :
 pwd is correct && ok = true ||
 pwd is wrong && ok = false
end_process ;`))
    expect(d.length).toBeGreaterThan(0)
    expect(d.every((x) => x.code === 'ASFL_FSF_206' && x.severity === 'warning')).toBe(true)
  }, 30000)

  it('T14 only others: pass without solver', async () => {
    let called = 0
    const d = await l2(mod(`process Noop (x: int) y: int
FSF :
 others && y = x
end_process ;`), { l2: { solve: async (_k: any, run: any) => { called++; return run() } } })
    expect(d).toEqual([])
    expect(called).toBe(0)
  }, 30000)

  it('T15 non-linear: never an error', async () => {
    const d1 = await l2(mod(`process NL (x, y: int) r: bool
FSF :
 x * x = 2 * y * y and x > 0 && r = true ||
 others && r = false
end_process ;`))
    expect(codes(d1)).toEqual(['ASFL_FSF_209'])
    const d2 = await l2(mod(`process NL (x, y: int) r: bool
FSF :
 x * x > y && r = true ||
 x * x <= y && r = false
end_process ;`))
    expect(d2.every((x) => x.code === 'ASFL_FSF_203' || x.code === 'ASFL_FSF_204')).toBe(true)
  }, 30000)

  it('T16 timeout path (mock solver) -> warning 204', async () => {
    const d = await l2(mod(`process Cmp (x, y: int) r: int
FSF :
 x > y && r = 1 ||
 x <= y && r = 0
end_process ;`), { l2: { solve: async () => ({ status: 'unknown', reason: 'timeout' }) } })
    expect(codes(d)).toEqual(['ASFL_FSF_204', 'ASFL_FSF_204'])
    expect(d.every((x) => x.severity === 'warning')).toBe(true)
  }, 30000)

  it('L1 failure skips L2 with 207', async () => {
    expect(codes(await l2(mod(`process P (x: int) r: int
FSF :
 r > 0 && r = 1 ||
 r <= 0 && r = 0
end_process ;`)))).toEqual(['ASFL_FSF_207'])
  }, 30000)

  it('chained comparison and Register_Stock/Card fixtures', async () => {
    expect(await l2(mod(`process P (x: int) r: bool
FSF :
 0 <= x <= 100 && r = true ||
 x < 0 && r = false ||
 x > 100 && r = false
end_process ;`))).toEqual([])
  }, 30000)

  it('can be disabled with fsfL2: false', async () => {
    expect(await l2(mod(`process A (x,y: int) q1: int
FSF :
 x > y && q1 = 1
end_process ;`), { fsfL2: false })).toEqual([])
  })
})

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
describe('freeze gate: reference systems have zero errors on parser + L1 + L2', () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'reference-systems')
  for (const f of ['classroom-reference.asfl', 'delivery-reference.asfl']) {
    it(f, async () => {
      const r = await checkAsync(readFileSync(join(dir, f), 'utf-8'))
      expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    }, 60000)
  }
})
