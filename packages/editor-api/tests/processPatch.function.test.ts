import { describe, expect, it } from 'vitest'
import { parse } from '@agile-sofl/parser'
import { patchFunction } from '../src/processPatch.js'

const sample = `module M;
function add(x: nat, y: nat) : nat
    == x + y
end_function
end_module.`

describe('patchFunction', () => {
  it('updates function body', () => {
    const next = patchFunction(sample, { moduleName: 'M', name: 'add', body: 'x * y' })
    expect(next).toContain('== x * y')
    const { ast } = parse(next)
    const fn = ast?.modules[0]?.functions[0]
    expect(fn?.body).toBeTruthy()
  })

  it('inserts FSF block', () => {
    const next = patchFunction(sample, {
      moduleName: 'M',
      name: 'add',
      fsf: { scenarios: [{ id: '1', test: 'true', def: 'x + y', span: { start: 0, end: 0, line: 1, column: 1 } }] }
    })
    expect(next).toContain('FSF :')
    expect(next).toContain('true && x + y')
  })
})
