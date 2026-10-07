import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { check } from '../../src/index'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'fsf-final')
const load = (n: string) => readFileSync(join(dir, n), 'utf-8')
const errors = (src: string) => check(src).diagnostics.filter((d) => d.severity === 'error')

function collect(node: unknown, pred: (n: any) => boolean, out: any[] = []): any[] {
  if (Array.isArray(node)) node.forEach((n) => collect(n, pred, out))
  else if (node && typeof node === 'object') {
    if (pred(node)) out.push(node)
    Object.values(node).forEach((v) => collect(v, pred, out))
  }
  return out
}

describe('final-grammar FSF (regression for ASFL_PARSE_001 on ~ / elems( / dom()', () => {
  for (const f of ['register_stock.asfl', 'card.asfl', 'card_semiformal.asfl', 'grammar_A.asfl', 'grammar_A_no_others.asfl']) {
    it(`${f} parses without errors`, () => {
      expect(errors(load(f))).toEqual([])
    })
  }

  it('represents ~x as old-state identifier, not negation', () => {
    const { ast } = check(load('register_stock.asfl'))
    const olds = collect(ast, (n) => n.type === 'identifier' && n.oldState === true)
    expect(olds.map((n) => n.name)).toContain('stock_list')
    expect(collect(ast, (n) => 'negated' in n)).toHaveLength(0)
  })

  it('parses elems(~s) and dom(~m) as calls', () => {
    const rs = collect(check(load('register_stock.asfl')).ast, (n) => n.type === 'call' && n.callee === 'elems')
    expect(rs.length).toBe(2)
    expect(rs[0].args[0]).toMatchObject({ type: 'identifier', name: 'stock_list', oldState: true })
    const card = collect(check(load('card.asfl')).ast, (n) => n.type === 'call' && n.callee === 'dom')
    expect(card.length).toBeGreaterThanOrEqual(2)
  })

  it('accepts a set-valued binding domain forall[k: dom(cards)]', () => {
    const groups = collect(check(load('card.asfl')).ast, (n) => n.type === 'binding_group')
    expect(groups[0].names).toEqual(['k'])
    expect(groups[0].domainExpr).toMatchObject({ type: 'call', callee: 'dom' })
  })

  it('keeps keyword words inside natural-language atoms and splits at formal `and`', () => {
    const { ast } = check(load('card_semiformal.asfl'))
    const texts = collect(ast, (n) => typeof n.text === 'string' && /card is registered/.test(n.text))
    expect(texts.length).toBeGreaterThan(0)
    const rel = collect(ast, (n) => n.type === 'relational_expr' && n.left?.name === 'msg')
    expect(rel.length).toBe(2)
  })

  it('FSF with others branch has three scenarios / two + others', () => {
    const fsf = collect(check(load('grammar_A.asfl')).ast, (n) => n.type === 'fsf_spec')[0]
    expect(fsf.scenarios.length).toBe(2)
    expect(fsf.others ?? fsf.othersDef ?? fsf.otherwise).toBeTruthy()
  })
})
