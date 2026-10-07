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

describe('L2 stats leaf flag', () => {
  it('marks processes with decom: as non-leaf', async () => {
    const stats: L2ProcessStats[] = []
    await checkFsfL2(check(load('classroom-reference.asfl')).ast!, { stats })
    const att = stats.find((s) => s.process === 'Attendance')!
    expect(att.leaf).toBe(false)
    expect(att.decomposition).toBe('Records_Decom')
    expect(att.tests[0]!.status).toBe('informal')
    expect(att.tests[0]!.span).toBeDefined()
    expect(stats.filter((s) => s.leaf).length).toBe(18)
  }, 60000)
})
