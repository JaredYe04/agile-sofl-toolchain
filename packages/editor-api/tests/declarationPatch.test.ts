import { describe, it, expect } from 'vitest'
import {
  patchConst,
  addConst,
  removeConst,
  addVar,
  patchVar,
  patchDeclaration
} from '../src/declarationPatch.js'

const SOURCE = `module SYSTEM_Banking;
const
withdraw_limit = 10000;
var
salary: nat;
end_module`

describe('declarationPatch', () => {
  it('patchConst updates a constant value', () => {
    const next = patchConst(SOURCE, 'Banking', 'withdraw_limit', 'withdraw_limit = 20000;')
    expect(next).toContain('withdraw_limit = 20000')
    expect(next).not.toContain('10000')
  })

  it('addConst appends to const block', () => {
    const next = addConst(SOURCE, 'Banking', 'transfer_limit = 5000;')
    expect(next).toContain('transfer_limit = 5000')
  })

  it('removeConst removes a constant', () => {
    const next = removeConst(SOURCE, 'Banking', 'withdraw_limit')
    expect(next).not.toContain('withdraw_limit')
  })

  it('addVar creates var block when missing', () => {
    const bare = `module SYSTEM_T;\nend_module`
    const next = addVar(bare, 'T', 'x: nat')
    expect(next).toContain('var')
    expect(next).toContain('x: nat')
  })

  it('patchVar updates variable type', () => {
    const next = patchVar(SOURCE, 'Banking', 'salary', 'salary: int;')
    expect(next).toContain('salary: int')
  })

  it('patchDeclaration routes add const', () => {
    const next = patchDeclaration(SOURCE, {
      moduleName: 'Banking',
      kind: 'const',
      action: 'add',
      text: 'fee = 1;'
    })
    expect(next).toContain('fee = 1')
  })
})
