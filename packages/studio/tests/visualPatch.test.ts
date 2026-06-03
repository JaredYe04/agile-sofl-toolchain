import { describe, it, expect } from 'vitest'
import { patchFsfSpec } from '@agile-sofl/editor-api'

const source = `module SYSTEM_T;
process Ping (x: nat) ok: nat
FSF :
x > 0 && ok = 1 ||
others && ok = 0
end_process
end_module`

describe('visual patch roundtrip', () => {
  it('patchFsfSpec updates FSF scenarios in source', () => {
    const next = patchFsfSpec(
      source,
      'Ping',
      [{ id: 's1', test: 'x > 0', def: 'ok = 2', span: { start: 0, end: 0, line: 1, column: 1 } }],
      'ok = 0'
    )
    expect(next).toContain('ok = 2')
    expect(next).toContain('others && ok = 0')
    expect(next).not.toBe(source)
  })
})
