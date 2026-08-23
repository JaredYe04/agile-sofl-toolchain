import { describe, expect, it } from 'vitest'
import { extractInformalDraft } from '../src/renderer/specAssist/heuristicInformal'
import { toAsflIdent } from '../src/renderer/specAssist/ident'

describe('extractInformalDraft', () => {
  it('extracts 功能/数据/约束 and numbered F_n lines', () => {
    const items = extractInformalDraft(`
功能：借书
数据：馆藏副本
约束：逾期须罚款
F_2 还书
functions:
  - name: ignored
`)
    expect(items.map((i) => i.patch?.action)).toEqual([
      'add-process',
      'add-variable',
      'add-invariant',
      'add-process'
    ])
  })
})

describe('toAsflIdent', () => {
  it('turns a phrase into an identifier', () => {
    expect(toAsflIdent('Borrow a book')).toBe('Borrow_a_book')
  })
})
