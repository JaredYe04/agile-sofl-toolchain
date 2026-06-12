import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  buildVisualModelTolerant,
  patchProcessInit,
  buildProcessSignatureFromGroups,
  buildFunctionSignatureFromGroups
} from '../src/index.js'

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), '../../parser/tests/fixtures/grammar')

function loadFixture(rel: string): string {
  return readFileSync(join(fixtureRoot, rel), 'utf8')
}

describe('Phase 6 structured signature', () => {
  it('builds process and function signatures from param groups', () => {
    expect(
      buildProcessSignatureFromGroups(
        [{ names: 'x', type: 'nat' }],
        [{ names: 'ok', type: 'nat' }]
      )
    ).toBe('(x: nat) ok: nat')
    expect(buildFunctionSignatureFromGroups([{ names: 'amount', type: 'nat' }], 'bool')).toBe(
      '(amount: nat): bool'
    )
  })

  it('exposes structured params in DTO', () => {
    const source = `module M;\nprocess P (x: nat) ok: nat\nFSF :\nx > 0 && ok = 1\nend_process\nend_module`
    const model = buildVisualModelTolerant(source)
    const p = model.modules[0]?.processes[0]
    expect(p?.inputs).toEqual([{ names: 'x', type: 'nat' }])
    expect(p?.outputs).toEqual([{ names: 'ok', type: 'nat' }])
  })

  it('merges classifyFsf info diagnostics', () => {
    const source = `module M;\nprocess P ()\nFSF :\ntrue && true\nend_process\nend_module`
    const model = buildVisualModelTolerant(source)
    expect(model.diagnostics.some((d) => d.severity === 'info')).toBe(true)
  })
})

describe('patchProcessInit', () => {
  it('toggles Init keyword on process name', () => {
    const source = `module M;\nprocess P ()\nFSF :\nothers && true\nend_process\nend_module`
    const init = patchProcessInit(source, 'M', 'P', true)
    expect(init).toContain('process Init ()')
    const back = patchProcessInit(init, 'M', 'Init', false, 'P')
    expect(back).toContain('process P ()')
  })
})
