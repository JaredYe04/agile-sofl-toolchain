import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { check } from '../../src/index'
import { checkFsfL2, type L2ProcessStats } from '../../src/fsf/l2Check'

const load = (n: string) => readFileSync(join(__dirname, '../fixtures/reference-systems', n), 'utf-8')

describe('L2 coverage stats collector', () => {
  it('records decided / informal / unsupported outcomes per process (delivery)', async () => {
    const stats: L2ProcessStats[] = []
    await checkFsfL2(check(load('delivery-reference.asfl')).ast!, { stats })
    expect(stats.length).toBe(14)
    const cancel = stats.find((s) => s.process === 'CancelOrder')!
    expect(cancel.tests.map((t) => t.reason)).toEqual(['composed type', 'composed type'])
    expect(cancel.exclusion).toEqual([{ i: 1, j: 2, outcome: 'skipped', skipReasons: ['composed type', 'composed type'] }])
    expect(cancel.completeness.outcome).toBe('others')
    expect(stats.find((s) => s.process === 'AutoComplete')!.completeness.outcome).toBe('unsat')
  }, 60000)
})
