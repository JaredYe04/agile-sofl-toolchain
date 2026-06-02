import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { runRepl } from '../../src/cli/repl.js'

const emitters: EventEmitter[] = []

vi.mock('node:readline', () => ({
  createInterface: () => {
    const ee = new EventEmitter()
    emitters.push(ee)
    return {
      on: (ev: string, fn: (...args: unknown[]) => void) => {
        ee.on(ev, fn)
        return ee
      },
      prompt: () => {},
      close: () => {
        ee.emit('close')
      }
    }
  }
}))

describe('REPL unit', () => {
  beforeEach(() => {
    emitters.length = 0
  })

  async function runLines(...lines: string[]) {
    const p = runRepl()
    const ee = emitters[0]
    for (const line of lines) {
      ee.emit('line', line)
    }
    ee.emit('line', ':quit')
    await p
  }

  it('handles :check one-liner', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runLines(':check module SYSTEM_T; var x: nat; end_module')
    expect(log.mock.calls.some((c) => String(c[0]).includes('SYSTEM_T'))).toBe(true)
    log.mockRestore()
  })

  it('handles buffer + blank line submit', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runLines('module SYSTEM_T;', 'var x: nat;', 'end_module', '')
    expect(log.mock.calls.length).toBeGreaterThan(0)
    log.mockRestore()
  })

  it('handles :tree :tokens :format :clear :help', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runLines(
      ':help',
      ':clear',
      ':check module SYSTEM_T; end_module',
      ':tree module SYSTEM_T; end_module',
      ':tokens module SYSTEM_T; end_module',
      ':format module SYSTEM_T; end_module'
    )
    expect(log.mock.calls.some((c) => String(c[0]).includes('Agile-SOFL REPL'))).toBe(true)
    log.mockRestore()
  })

  it('warns on unknown command and empty :check', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runLines(':nope', ':check')
    expect(log.mock.calls.some((c) => String(c[0]).includes('Unknown command'))).toBe(true)
    log.mockRestore()
  })
})
