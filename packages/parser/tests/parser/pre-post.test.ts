import { describe, it, expect } from 'vitest'
import { parse, deriveFsf, printProgram } from '../../src/index'
import { expectParseOk } from '../helpers/index'
import { isProgramNode } from '../../src/ast/guards'

describe('Parser - semi-formal pre/post', () => {
  it('parses formal pre/post predicates', () => {
    const source = `module SYSTEM_P;
process Withdraw(amount: real) cash: real
pre
    amount > 0
post
    cash = amount
end_process
end_module`
    const ast = expectParseOk(source, parse)
    if (!isProgramNode(ast)) return
    const body = ast.modules[0]!.processes[0]!.body
    expect(body?.pre?.text).toContain('amount > 0')
    expect(body?.post?.text).toContain('cash = amount')
    expect(body?.fsf).toBeUndefined()
  })

  it('parses structured natural-language pre/post', () => {
    const source = `module SYSTEM_P;
process Withdraw(amount: real) cash: real, error_message: string
pre
    The specified account exists
    and the withdrawal amount is positive
post
    if amount is less than the balance
    then supply cash with the same amount
    else output an appropriate error message
end_process
end_module`
    const ast = expectParseOk(source, parse)
    if (!isProgramNode(ast)) return
    const body = ast.modules[0]!.processes[0]!.body
    expect(body?.pre?.kind).toBe('natural-language')
    expect(body?.post?.kind).toBe('structured')
    expect(body?.post?.conditional?.guard.text).toMatch(/amount/i)
    expect(body?.post?.conditional?.thenClause.text).toMatch(/supply cash/i)
    expect(body?.post?.conditional?.elseClause?.text).toMatch(/error/i)
  })

  it('still parses legacy FSF source', () => {
    const source = `module SYSTEM_P;
process P (x: int) y: nat
FSF :
x > 0 && y > 0 ||
others && y = 1
end_process
end_module`
    const ast = expectParseOk(source, parse)
    if (!isProgramNode(ast)) return
    expect(ast.modules[0]!.processes[0]!.body?.fsf?.scenarios).toHaveLength(1)
  })

  it('derives FSF from pre/post if-then-else', () => {
    const source = `module SYSTEM_P;
process Withdraw(amount: real) cash: real
pre
    amount > 0
post
    if amount <= 10 then cash = amount else cash = 0
end_process
end_module`
    const ast = expectParseOk(source, parse)
    if (!isProgramNode(ast)) return
    const form = deriveFsf(ast.modules[0]!.processes[0]!)
    expect(form?.source).toBe('derived')
    expect(form?.scenarios.length).toBeGreaterThanOrEqual(1)
    expect(form?.exceptionalScenarios.length).toBe(1)
    expect(form?.exceptionalScenarios[0]?.name).toMatch(/Precondition/i)
  })

  it('parses generated library-style post', () => {
    const source = `module SYSTEM_Library;
process Borrow (member_id: nat, book_id: nat) success: nat
    post
        if member and book ids are valid then success is 1 else success is 0
    decom: Library_Borrow
    comment: informal aspec_proc_borrow
end_process
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0]!.processes[0]!.body?.post?.kind).toBe('structured')
    }
  })

  it('parses English pre/post containing keyword to', () => {
    const source = `module SYSTEM_P;
process Withdraw(amount: real) cash: real
pre
    The system shall allow a customer to withdraw money
post
    if the amount does not exceed the balance then cash is supplied else an error is returned
end_process
end_module`
    const ast = expectParseOk(source, parse)
    if (!isProgramNode(ast)) return
    expect(ast.modules[0]!.processes[0]!.body?.pre?.text).toMatch(/withdraw/i)
  })

  it('prints pre/post instead of FSF when both exist', () => {
    const source = `module SYSTEM_P;
process P (x: nat) y: nat
pre
    x > 0
post
    y = x
end_process
end_module`
    const ast = expectParseOk(source, parse)
    if (!isProgramNode(ast)) return
    const printed = printProgram(ast)
    expect(printed).toContain('pre')
    expect(printed).toContain('post')
    expect(printed).not.toContain('FSF')
  })
})
