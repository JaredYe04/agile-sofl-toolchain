import { describe, it, expect } from 'vitest'
import { tokenize } from '../../src/lexer/lexer'

describe('Lexer boundaries', () => {
  it('does not split informal into in keyword', () => {
    const r = tokenize('comment: informal note')
    const images = r.tokens.map((t) => t.image)
    expect(images).toContain('informal')
    expect(images).toContain('note')
    expect(images.some((i) => i === 'in')).toBe(false)
  })

  it('tokenizes others as single keyword', () => {
    const r = tokenize('others && x = 1')
    expect(r.tokens[0].image).toBe('others')
  })

  it('tokenizes enum angle brackets', () => {
    const r = tokenize('const c = <red>;')
    expect(r.tokens.some((t) => t.tokenType.name === 'EnumValue')).toBe(true)
    expect(r.tokens.filter((t) => t.tokenType.name === 'EnumValue').map((t) => t.image)).toEqual([
      '<red>'
    ])
  })

  it('does not treat comparison as enum when > appears later in source', () => {
    const r = tokenize('k < 5; others && x > 0')
    const lt = r.tokens.filter((t) => t.tokenType.name === 'LessThan')
    const gt = r.tokens.filter((t) => t.tokenType.name === 'GreaterThan')
    expect(lt).toHaveLength(1)
    expect(gt).toHaveLength(1)
    expect(r.tokens.some((t) => t.tokenType.name === 'EnumValue')).toBe(false)
  })

  it('tokenizes real literals', () => {
    const r = tokenize('const x = 3.14;')
    expect(r.tokens.some((t) => t.tokenType.name === 'RealLiteral')).toBe(true)
  })

  it('treats first block comment close as end of comment', () => {
    const r = tokenize('/* outer /* inner */ still comment */ module')
    expect(r.tokens.map((t) => t.image)).toEqual(['still', 'comment', '*', '/', 'module'])
  })

  it('reports no lex errors for banking snippet', () => {
    const r = tokenize('forall[c: customers] | c.balance > 0')
    expect(r.errors).toHaveLength(0)
  })
})
