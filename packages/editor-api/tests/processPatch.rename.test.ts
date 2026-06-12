import { describe, it, expect } from 'vitest'
import { renameFunction, renameProcess, patchProcess } from '../src/processPatch.js'

const SOURCE = `module M
process OldP (x: nat) ok: nat
FSF :
x > 0 && ok = 1
end_process
function OldF (x: nat): nat
== x + 1
end_function
end_module`

describe('renameFunction', () => {
  it('renames function identifier', () => {
    const next = renameFunction(SOURCE, 'M', 'OldF', 'NewF')
    expect(next).toContain('function NewF')
    expect(next).not.toContain('function OldF')
  })

  it('patchProcess supports function rename', () => {
    const next = patchProcess(SOURCE, {
      moduleName: 'M',
      kind: 'function',
      action: 'rename',
      name: 'OldF',
      newName: 'RenamedF'
    })
    expect(next).toContain('function RenamedF')
  })
})

describe('renameProcess', () => {
  it('renames process identifier', () => {
    const next = renameProcess(SOURCE, 'M', 'OldP', 'NewP')
    expect(next).toContain('process NewP')
    expect(next).not.toContain('process OldP')
  })
})
