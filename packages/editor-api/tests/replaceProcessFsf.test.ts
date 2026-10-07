import { describe, it, expect } from 'vitest'
import { check } from '@agile-sofl/parser'
import { applyHybridPatch } from '../src/hybridPatch'

const base = `module SYSTEM_T;
process Sign (n: int) z: bool
    pre true
    post z = true
end_process
process Cmp (x, y: int) r: int
    FSF :
    x > y && r = 1 ||
    others && r = 0
end_process
end_module.`

describe('replace-process-body with fsf', () => {
  it('replaces an existing FSF clause', () => {
    const out = applyHybridPatch(base, { operations: [{ op: 'replace-process-body', id: 'proc:SYSTEM_T.Cmp', fsf: 'x > y && r = 1 || x = y && r = 0 || others && r = -1' }] } as any)
    expect(out.error).toBeUndefined()
    expect(out.content).toContain('x = y && r = 0 || others && r = -1')
    expect(check(out.content).diagnostics.filter((d) => d.severity === 'error')).toEqual([])
  })

  it('inserts an FSF clause into a pre/post process', () => {
    const out = applyHybridPatch(base, { operations: [{ op: 'replace-process-body', id: 'proc:SYSTEM_T.Sign', fsf: 'FSF: n >= 0 && z = true || others && z = false' }] } as any)
    expect(out.error).toBeUndefined()
    const { ast, diagnostics } = check(out.content)
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    const proc = ast!.modules[0]!.processes.find((p) => p.name === 'Sign')!
    expect(proc.body?.fsf?.scenarios.length).toBe(1)
    expect(proc.body?.fsf?.others).toBeTruthy()
  })
})
