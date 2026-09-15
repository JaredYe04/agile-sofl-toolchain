import { describe, expect, it } from 'vitest'
import {
  nextConstName,
  nextInvariantPlaceholder,
  nextNumberedName,
  nextProcessName,
  nextTypeName,
  nextVarName
} from '../src/renderer/lib/visualNames'

describe('visualNames', () => {
  it('skips colliding numbered names', () => {
    expect(nextTypeName(['Type1', 'Type2'])).toBe('Type3')
    expect(nextVarName(['var1'])).toBe('var2')
    expect(nextConstName(['Const1'])).toBe('Const2')
    expect(nextProcessName(['Process1', 'Init'])).toBe('Process2')
  })

  it('allocates distinct invariant placeholders', () => {
    expect(nextInvariantPlaceholder([])).toBe('1 <= 1')
    expect(nextInvariantPlaceholder(['1 <= 1'])).toBe('2 <= 2')
    expect(nextInvariantPlaceholder(['1 <= 1', '2 <= 2', 'true'])).toBe('3 <= 3')
  })

  it('supports custom prefixes', () => {
    expect(nextNumberedName('fn', ['fn1', 'fn3'])).toBe('fn2')
  })
})
