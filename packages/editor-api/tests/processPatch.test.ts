import { describe, it, expect } from 'vitest'
import { addProcess, removeProcess, addFunction, removeFunction, patchProcess } from '../src/processPatch.js'

const SOURCE = `module SYSTEM_Demo;
process P1 (x: nat) ok: nat
FSF :
x > 0 && ok = 1 ||
others && ok = 0
end_process
function f1(x: nat): nat
== x
end_function
end_module`

describe('processPatch', () => {
  it('addProcess inserts a process block', () => {
    const next = addProcess(SOURCE, 'Demo', 'P2')
    expect(next).toContain('process P2')
    expect(next).toContain('process P1')
  })

  it('removeProcess deletes a process', () => {
    const next = removeProcess(SOURCE, 'Demo', 'P1')
    expect(next).not.toContain('process P1')
    expect(next).toContain('function f1')
  })

  it('addFunction inserts a function', () => {
    const next = addFunction(SOURCE, 'Demo', 'f2')
    expect(next).toContain('function f2')
  })

  it('removeFunction deletes a function', () => {
    const next = removeFunction(SOURCE, 'Demo', 'f1')
    expect(next).not.toContain('function f1')
  })

  it('patchProcess routes add process', () => {
    const next = patchProcess(SOURCE, {
      moduleName: 'Demo',
      kind: 'process',
      action: 'add',
      name: 'P3'
    })
    expect(next).toContain('process P3')
  })
})
