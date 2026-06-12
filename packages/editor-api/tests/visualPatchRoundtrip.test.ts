import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from '@agile-sofl/parser'
import {
  buildVisualModelTolerant,
  patchComment,
  patchDecom,
  patchDeclaration,
  patchExt,
  patchProcessSignature,
  patchInvariant,
  patchFsfSpec,
  patchFunction
} from '../src/index.js'

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), '../../parser/tests/fixtures/grammar')

function loadFixture(rel: string): string {
  return readFileSync(join(fixtureRoot, rel), 'utf8')
}

const PROCESS_DEMO = `module SYSTEM_Demo;
process Demo (x: nat) ok: nat
FSF :
x > 0 && ok = 1 ||
others && ok = 0
decom: Demo
comment: note
end_process
end_module`

const DECL_SOURCE = `module SYSTEM_Banking;
const
withdraw_limit = 10000;
var
salary: nat;
end_module`

const INV_SOURCE = `module SYSTEM_M;
inv x > 0;
process P (x: nat) ok: nat
FSF :
others && ok = 0
end_process
end_module`

const FUNCTION_SOURCE = `module SYSTEM_M;
function add(x: nat, y: nat) : nat
    == x + y
end_function
end_module`

function expectParseOk(source: string): void {
  const { diagnostics } = parse(source)
  expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
}

describe('visual patch roundtrip', () => {
  it('comment and decom', () => {
    let next = patchComment(PROCESS_DEMO, 'Demo', 'updated note')
    next = patchDecom(next, 'Demo', 'NewRef')
    expectParseOk(next)
    expect(next).not.toMatch(/comment:\s*comment:/)
    expect(next).not.toMatch(/decom:\s*decom:/)
    const model = buildVisualModelTolerant(next)
    const proc = model.modules[0]?.processes.find((p) => p.name === 'Demo')
    expect(proc?.comment).toBe('updated note')
    expect(proc?.decom).toBe('NewRef')
  })

  it('declaration const', () => {
    const next = patchDeclaration(DECL_SOURCE, {
      moduleName: 'Banking',
      kind: 'const',
      action: 'patch',
      name: 'withdraw_limit',
      text: 'withdraw_limit = 20000;'
    })
    expectParseOk(next)
    expect(next).toContain('withdraw_limit = 20000')
    const { ast } = parse(next)
    const c = ast?.modules[0]?.consts.find((x) => x.name === 'withdraw_limit')
    expect(c?.value?.type === 'number_literal' && c.value.value).toBe(20000)
  })

  it('ext block', () => {
    const source = loadFixture('processes/ext-alias.asfl')
    const next = patchExt(source, 'Proc', 'Worker', [{ access: 'wr', name: 'out', type: 'int' }])
    expectParseOk(next)
    const model = buildVisualModelTolerant(next)
    const proc = model.modules[0]?.processes.find((p) => p.name === 'Worker')
    expect(proc?.ext).toEqual([{ access: 'wr', name: 'out', type: 'int' }])
  })

  it('process signature', () => {
    const source = loadFixture('processes/ext-alias.asfl')
    const next = patchProcessSignature(source, 'Proc', 'Worker', '(x: nat) ok: nat')
    expectParseOk(next)
    const model = buildVisualModelTolerant(next)
    const proc = model.modules[0]?.processes.find((p) => p.name === 'Worker')
    expect(proc?.signature).toBe('(x: nat) ok: nat')
  })

  it('invariant', () => {
    const inv = INV_SOURCE.match(/inv x > 0;/)!
    const start = INV_SOURCE.indexOf(inv[0])
    const end = start + inv[0].length
    const next = patchInvariant(INV_SOURCE, { start, end }, 'inv y >= 1;')
    expectParseOk(next)
    const model = buildVisualModelTolerant(next)
    expect(model.modules[0]?.invariants[0]?.text).toContain('y >= 1')
  })

  it('fsf scenarios', () => {
    const next = patchFsfSpec(
      PROCESS_DEMO,
      'Demo',
      [{ id: '1', test: 'true', def: 'ok = 0', span: { start: 0, end: 0, line: 1, column: 1 } }],
      'ok = 1'
    )
    expectParseOk(next)
    const model = buildVisualModelTolerant(next)
    expect(model.fsfModels.some((m) => m.processName === 'Demo')).toBe(true)
  })

  it('function body', () => {
    const next = patchFunction(FUNCTION_SOURCE, { moduleName: 'M', name: 'add', body: 'x * y' })
    expectParseOk(next)
    const model = buildVisualModelTolerant(next)
    const fn = model.modules[0]?.functions.find((f) => f.name === 'add')
    expect(fn?.body).toBe('x * y')
  })
})
