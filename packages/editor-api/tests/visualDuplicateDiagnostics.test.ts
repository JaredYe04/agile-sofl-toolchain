import { describe, expect, it } from 'vitest'
import { parse } from '@agile-sofl/parser'
import { buildVisualModelTolerant } from '../src/visualParse.js'
import { VISUAL_DUPLICATE_CODE } from '../src/visualDuplicateDiagnostics.js'

describe('visual duplicate diagnostics', () => {
  it('flags duplicate invariants in a module', () => {
    const source = `module M;
inv
  1 <= 1;
  1 <= 1;
end_module`
    const model = buildVisualModelTolerant(source)
    const dupes = model.diagnostics.filter((d) => d.code === VISUAL_DUPLICATE_CODE)
    expect(dupes.length).toBeGreaterThanOrEqual(1)
    expect(model.hasDiagnostics).toBe(true)
  })

  it('flags duplicate process names', () => {
    const source = `module M;
process P (x: nat) ok: nat
    pre
        true
    post
        true
end_process
process P (y: nat) ok: nat
    pre
        true
    post
        true
end_process
end_module`
    const model = buildVisualModelTolerant(source)
    expect(model.diagnostics.some((d) => d.code === VISUAL_DUPLICATE_CODE)).toBe(true)
  })

  it('flags duplicate module names case-insensitively', () => {
    const source = `module Foo;
end_module
module foo;
end_module`
    const { ast } = parse(source)
    expect(ast?.type).toBe('program')
    const model = buildVisualModelTolerant(source)
    expect(model.diagnostics.some((d) => d.code === VISUAL_DUPLICATE_CODE)).toBe(true)
  })
})
