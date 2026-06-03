import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tokenize } from '../../src/lexer/lexer'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const matrix = JSON.parse(
  readFileSync(join(repoRoot, 'tests/fixtures/keyword-collision-matrix.json'), 'utf-8')
) as Array<{ identifier: string; lexer: string }>

function tokenImages(source: string): string[] {
  return tokenize(source).tokens.map((t) => t.image)
}

function tokenNames(source: string): string[] {
  return tokenize(source).tokens.map((t) => t.tokenType.name)
}

describe('Lexer keyword boundaries', () => {
  it.each(matrix)('keeps $identifier as $lexer', ({ identifier, lexer }) => {
    const names = tokenNames(identifier)
    expect(names).toEqual([lexer])
    expect(tokenImages(identifier)).toEqual([identifier])
  })

  it('tokenizes map type to keyword without splitting identifiers', () => {
    const names = tokenNames('map string to nat')
    expect(names).toContain('Map')
    expect(names).toContain('To')
    expect(names).not.toContain('Identifier')
  })

  it('tokenizes inset and notin as operators', () => {
    expect(tokenNames('x inset s')).toContain('Inset')
    expect(tokenNames('x notin s')).toContain('Notin')
  })

  it('does not split informal in comment line', () => {
    const images = tokenImages('comment: informal add product when customer is active')
    expect(images).toContain('informal')
    expect(images).not.toContain('in')
    expect(images.filter((i) => i === 'in')).toHaveLength(0)
  })

  it('tokenizes comment and decom as keywords at line start', () => {
    expect(tokenNames('comment: note')).toContain('Comment')
    expect(tokenNames('decom: Diagram')).toContain('Decom')
  })

  it('tokenizes others as keyword', () => {
    expect(tokenImages('others && x = 1')[0]).toBe('others')
  })

  it('tokenizes end_module without splitting end', () => {
    const names = tokenNames('end_module')
    expect(names).toEqual(['EndModule'])
  })

  it('tokenizes modify as single keyword not mod + suffix', () => {
    expect(tokenNames('modify x')).toEqual(['Modify', 'Identifier'])
  })

  it('tokenizes is_nat prefix on identifiers', () => {
    expect(tokenNames('is_nat(x)')).toContain('IsTypePrefix')
  })
})
