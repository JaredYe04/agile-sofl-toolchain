import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { addProcess } from '../src/processPatch.js'
import { applyHybridPatch, formatHybridInventory } from '../src/index.js'

const IMPLICIT = `module Auth;
type
  Role = {Investor} | {Broker};
  UserAccount = user_id: nat, role: Role, balance: real;
end_module`

describe('hybrid CRUD insert against implicit records', () => {
  it('addProcess does not split a type field list', () => {
    const next = addProcess(IMPLICIT, 'Auth', 'Login', `process Login (user_id: nat) ok: bool
    pre
        true
    post
        ok = true
end_process`)
    expect(next).toContain('UserAccount = user_id: nat, role: Role, balance: real;')
    expect(next.indexOf('process Login')).toBeGreaterThan(next.indexOf('balance: real'))
    expect(next.indexOf('process Login')).toBeLessThan(next.indexOf('end_module'))
    expect(next).not.toMatch(/UserAccount = user_id\s*\nprocess/)
  })

  it('inventory lists processes in the agent trading file', () => {
    const source = readFileSync(
      join(__dirname, '../../parser/tests/fixtures/hybrid/agent-trading.asfl'),
      'utf-8'
    )
    const inventory = formatHybridInventory(source, 80000)
    expect(inventory).toContain('proc:Auth.Login')
    expect(inventory).toContain('proc:Trading.PlaceOrder')
    expect(inventory).toMatch(/\(inv\)/)
    expect(inventory).toContain('gui:')
    expect(inventory).toContain('LoginView')
  })

  it('CRUD add type with field list does not drop modules', () => {
    const { content, error } = applyHybridPatch(
      `module Auth;
end_module
module MarketData;
end_module`,
      {
        operations: [
          {
            op: 'add',
            kind: 'type',
            parentId: 'mod:Auth',
            name: 'UserAccount',
            text: 'user_id: nat, role: Role, balance: real'
          }
        ]
      }
    )
    expect(error).toBeUndefined()
    expect(content).toContain('module MarketData')
    expect(content).toMatch(/composed of/)
    expect(content).toContain('user_id:')
  })
})
