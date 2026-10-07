import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { check } from '../../src/index'
import { inspect } from '../../src/cli/report'

const errs = (src: string) => check(src).diagnostics.filter((d) => d.severity === 'error')
const proc = (fsf: string, sig = '(x: int) r: bool', decls = '') =>
  `module SYSTEM_G;\n${decls}\nprocess P ${sig}\nFSF :\n ${fsf}\nend_process\nend_module.`

describe('final-grammar gaps (item 8)', () => {
  it('chained comparisons 0 <= x <= 100 and x > y >= 0 (G:431-440)', () => {
    const src = proc('0 <= x <= 100 && r = true || x > 100 >= 0 && r = false || others && r = false')
    expect(errs(src)).toEqual([])
    const atom: any = check(src).ast!.modules[0]!.processes[0]!.body!.fsf!.scenarios[0]!.test.disjuncts[0]!.atoms[0]
    expect(atom.kind).toBe('chain_lt')
    expect(atom.chainOps).toEqual(['le', 'le'])
    expect(atom.chainHigh).toMatchObject({ type: 'number_literal', value: 100 })
  })

  it('union types of named types and basic types (G:306-308)', () => {
    const src = `module SYSTEM_U;\ntype Circle = composed of r: nat end;\n Square = composed of s: nat end;\n Shape = Circle | Square;\n Id = nat | string;\nvar v: Shape;\nend_module.`
    expect(errs(src)).toEqual([])
    const t: any = check(src).ast!.modules[0]!.types.find((x) => x.name === 'Shape')!.typeExpr
    expect(t.type).toBe('union_type')
    expect(t.variants.map((v: any) => v.qualified?.name)).toEqual(['Circle', 'Square'])
  })

  it('domrb / domrt / rngrt / rngrb type-check and keep the map type (G:771-774)', () => {
    const src = proc('true && r = domrb(s, ~m) and dom(domrt(s, ~m)) = s and rngrt(~m, s) = rngrb(~m, s)',
      '(s: set of nat) r: map nat to nat', 'var m: map nat to nat;').replace('FSF :', 'ext rd m\nFSF :')
    expect(errs(src)).toEqual([])
  })

  it('commas inside natural-language atoms', () => {
    const src = proc('the request queries attendance by course, by date or by student && r = true || others && r = false')
    expect(errs(src)).toEqual([])
    expect(JSON.stringify(check(src).ast)).toContain('by course, by date or by student')
  })

  it('submodules see types declared in the parent (SYSTEM_) module', () => {
    const src = `module SYSTEM_A;\ntype Money = nat0;\nvar total: Money;\nend_module;\nmodule B / SYSTEM_A;\nvar fee: Money;\nprocess Q (x: Money) r: Money\nFSF :\n true && r = x\nend_process\nend_module.`
    expect(errs(src)).toEqual([])
  })

  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'reference-systems')
  for (const f of ['classroom-reference.asfl', 'delivery-reference.asfl']) {
    it(`reference system ${f}: zero errors (API check and CLI inspect)`, () => {
      const src = readFileSync(join(dir, f), 'utf-8')
      expect(errs(src)).toEqual([])
      expect(inspect(src).diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    })
  }

  it('CLI inspect includes L1 diagnostics', () => {
    const r = inspect(proc('r = true && r = true', '(x: int) r: bool'))
    expect(r.diagnostics.map((d) => d.code)).toContain('ASFL_FSF_101')
  })
})
