import { describe, expect, it } from 'vitest'
import { truncateDiagnostic } from '../src/renderer/utils/truncateDiagnostic'

describe('truncateDiagnostic', () => {
  it('truncates long messages', () => {
    const msg = 'a'.repeat(200)
    expect(truncateDiagnostic(msg, 120).length).toBeLessThanOrEqual(121)
  })

  it('shortens Expecting one of these messages', () => {
    const msg =
      'Expecting one of these tokens: foo, bar, baz, qux, quux, corge, grault, garply, waldo, fred, plugh'
    const out = truncateDiagnostic(msg, 80)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(80)
  })
})
