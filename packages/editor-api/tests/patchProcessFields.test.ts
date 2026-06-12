import { describe, expect, it } from 'vitest'
import { parse } from '@agile-sofl/parser'
import { patchComment, patchDecom, buildVisualModelTolerant } from '../src/index.js'

const SOURCE = `module SYSTEM_Demo;
process Demo (x: nat) ok: nat
FSF :
x > 0 && ok = 1 ||
others && ok = 0
decom: Demo
comment: test
end_process
end_module`

describe('patchComment', () => {
  it('updates existing comment without double prefix', () => {
    const next = patchComment(SOURCE, 'Demo', 'test123')
    expect(next).toContain('comment: test123')
    expect(next).not.toMatch(/comment:\s*comment:/)
    const { diagnostics } = parse(next)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })

  it('roundtrips comment value in visual DTO', () => {
    const next = patchComment(SOURCE, 'Demo', 'updated note')
    const model = buildVisualModelTolerant(next)
    const proc = model.modules[0]?.processes.find((p) => p.name === 'Demo')
    expect(proc?.comment).toBe('updated note')
  })

  it('inserts comment when missing', () => {
    const bare = `module M;\nprocess P ()\nFSF :\nothers && true\nend_process\nend_module`
    const next = patchComment(bare, 'P', 'new note')
    expect(next).toContain('comment: new note')
    expect(next).not.toMatch(/comment:\s*comment:/)
    const model = buildVisualModelTolerant(next)
    expect(model.modules[0]?.processes[0]?.comment).toBe('new note')
  })
})

describe('patchDecom', () => {
  it('updates existing decom without double prefix', () => {
    const next = patchDecom(SOURCE, 'Demo', 'OtherRef')
    expect(next).toContain('decom: OtherRef')
    expect(next).not.toMatch(/decom:\s*decom:/)
    const { diagnostics } = parse(next)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })

  it('roundtrips decom value in visual DTO', () => {
    const next = patchDecom(SOURCE, 'Demo', 'Banking')
    const model = buildVisualModelTolerant(next)
    const proc = model.modules[0]?.processes.find((p) => p.name === 'Demo')
    expect(proc?.decom).toBe('Banking')
  })
})
