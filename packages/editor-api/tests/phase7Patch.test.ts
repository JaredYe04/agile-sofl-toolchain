import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from '@agile-sofl/parser'
import {
  patchProcessSignature,
  patchFunctionSignature,
  validateProcessSignature,
  validateFunctionSignature,
  addProcess,
  patchProcessInit,
  buildVisualModelTolerant
} from '../src/index.js'

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), '../../parser/tests/fixtures/grammar')

function loadFixture(rel: string): string {
  return readFileSync(join(fixtureRoot, rel), 'utf8')
}

describe('signature validation', () => {
  it('rejects invalid process signature probe', () => {
    expect(validateProcessSignature('(bad: ').ok).toBe(false)
  })

  it('rejects duplicate parameter names', () => {
    const result = validateProcessSignature('(x: nat, x: int) ok: nat')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('Duplicate')
  })

  it('patchProcessSignature does not mutate source on invalid signature', () => {
    const source = loadFixture('processes/ext-alias.asfl')
    const next = patchProcessSignature(source, 'Proc', 'Worker', '(bad: ')
    expect(next).toBe(source)
  })

  it('patchFunctionSignature does not mutate source on invalid signature', () => {
    const source = `module SYSTEM_M;\nfunction f(x: nat): nat\n== x\nend_function\nend_module`
    const next = patchFunctionSignature(source, 'M', 'f', '(x: nat)')
    expect(next).toBe(source)
  })

  it('accepts valid process signature', () => {
    expect(validateProcessSignature('(x: nat) ok: nat').ok).toBe(true)
    expect(validateFunctionSignature('(x: nat): bool').ok).toBe(true)
  })
})

describe('addProcess init wizard', () => {
  const source = `module SYSTEM_M;\nend_module`

  it('adds Init process from template', () => {
    const template = `process Init ()\nFSF :\nothers && true\nend_process`
    const next = addProcess(source, 'M', 'Init', template)
    expect(next).toContain('process Init ()')
    const { diagnostics } = parse(next)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })

  it('roundtrips Init flag in visual DTO', () => {
    let next = addProcess(source, 'M', 'Init', `process Init ()\nFSF :\nothers && true\nend_process`)
    next = patchProcessInit(next, 'M', 'Init', false, 'P')
    const model = buildVisualModelTolerant(next)
    const proc = model.modules[0]?.processes.find((p) => p.name === 'P')
    expect(proc?.isInit).toBe(false)
    next = patchProcessInit(next, 'M', 'P', true)
    const model2 = buildVisualModelTolerant(next)
    expect(model2.modules[0]?.processes.find((p) => p.name === 'Init')?.isInit).toBe(true)
  })
})
