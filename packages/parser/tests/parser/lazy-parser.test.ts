import { describe, it, expect } from 'vitest'
import { getParser } from '../../src/parser/parser'
import { parse, parseStrict } from '../../src/parser/parse'

describe('lazy parser instances', () => {
  it('builds each instance once, on first use', () => {
    const a = getParser(true), b = getParser(true), s = getParser(false)
    expect(a).toBe(b)
    expect(s).not.toBe(a)
    expect(getParser(false)).toBe(s)
    expect(parse('module SYSTEM_A;\nend_module.').ast).toBeTruthy()
    expect(parseStrict('module SYSTEM_A;\nend_module.').ast).toBeTruthy()
  }, 30000)
})
