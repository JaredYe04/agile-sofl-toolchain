import { describe, it, expect } from 'vitest'
import { patchInvariant } from '../src/patch.js'

const SOURCE = `module M
inv x > 0
process P (x: nat) ok: nat
FSF :
others && ok = 0
end_process
end_module`

describe('patchInvariant', () => {
  it('replaces invariant text by span', () => {
    const start = SOURCE.indexOf('inv x > 0')
    const end = start + 'inv x > 0'.length
    const next = patchInvariant(SOURCE, { start, end }, 'inv y >= 1')
    expect(next).toContain('inv y >= 1')
    expect(next).not.toContain('inv x > 0')
  })
})
