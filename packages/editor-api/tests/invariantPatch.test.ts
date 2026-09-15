import { describe, expect, it } from 'vitest'
import { addInvariant, removeInvariantInModule, reorderInvariants } from '../src/invariantPatch.js'

const SOURCE = `module M
inv
  x > 0;
  y >= 1;
process P (x: nat) ok: nat
    pre
        true
    post
        true
end_process
end_module`

describe('invariantPatch', () => {
  it('adds an invariant into the inv section', () => {
    const next = addInvariant(SOURCE, 'M', 'z = 0')
    expect(next).toContain('z = 0')
    expect(next).toContain('x > 0')
  })

  it('reorders invariants', () => {
    const next = reorderInvariants(SOURCE, 'M', 0, 1)
    const inv = next.slice(next.indexOf('inv'), next.indexOf('process'))
    expect(inv.indexOf('y >= 1')).toBeLessThan(inv.indexOf('x > 0'))
  })

  it('removes an invariant by span', () => {
    const start = SOURCE.indexOf('x > 0')
    const end = start + 'x > 0'.length
    const next = removeInvariantInModule(SOURCE, 'M', { start, end })
    expect(next).not.toContain('x > 0')
    expect(next).toContain('y >= 1')
  })

  it('creates inv section when missing', () => {
    const bare = `module T;\nend_module`
    const next = addInvariant(bare, 'T', 'true')
    expect(next).toMatch(/inv/)
    expect(next).toContain('true')
  })
})
