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
    const r = tokenize('const c = <red, green>;')
    expect(r.tokens.some((t) => t.tokenType.name === 'EnumValue')).toBe(true)
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
