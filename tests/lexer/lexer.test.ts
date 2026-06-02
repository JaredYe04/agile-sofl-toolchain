import { describe, it, expect } from 'vitest'
import { tokenize } from '../../src/lexer/lexer'
import { loadFixture } from '../helpers/index'

describe('Lexer', () => {
  it('tokenizes keywords', () => {
    const result = tokenize('module process function const type var inv end_module')
    const images = result.tokens.map((t) => t.image)
    expect(images).toContain('module')
    expect(images).toContain('process')
    expect(images).toContain('end_module')
  })

  it('tokenizes SYSTEM_ prefix', () => {
    const result = tokenize('module SYSTEM_Banking')
    const images = result.tokens.map((t) => t.image)
    expect(images).toContain('SYSTEM_')
    expect(images).toContain('Banking')
  })

  it('tokenizes operators', () => {
    const result = tokenize('x <> y && a || b -> c')
    const images = result.tokens.map((t) => t.image)
    expect(images).toContain('<>')
    expect(images).toContain('&&')
    expect(images).toContain('||')
    expect(images).toContain('->')
  })

  it('tokenizes banking fixture snapshot', () => {
    const source = loadFixture('integration/banking.asfl')
    const result = tokenize(source)
    expect(result.errors).toHaveLength(0)
    expect(result.tokens.length).toBeGreaterThan(50)
    const images = result.tokens.map((t) => t.image)
    expect(images).toContain('FSF')
    expect(images).toContain('others')
    expect(images).toContain('decom')
  })

  it('skips block comments', () => {
    const result = tokenize('/* comment */ module')
    const images = result.tokens.map((t) => t.image)
    expect(images).toEqual(['module'])
  })
})
