import { describe, it, expect } from 'vitest'
import { check, checkAsync } from '../../src/index'
import { getZ3Timing } from '../../src/fsf/l2Check'

const spec = (fsf: string) => `module SYSTEM_Z;\nprocess P (x: int) r: int\nFSF :\n${fsf}\nend_process\nend_module.`

describe('lazy Z3', () => {
  it('parse/L1 and single-scenario+others FSFs do not load Z3; the first solver query does', async () => {
    check(spec(' x > 0 && r = 1 ||\n others && r = 0'))
    await checkAsync(spec(' x > 0 && r = 1 ||\n others && r = 0'))
    expect(getZ3Timing().loaded).toBe(false)
    await checkAsync(spec(' x > 0 && r = 1 ||\n x <= 0 && r = 0'))
    const t = getZ3Timing()
    expect(t.loaded).toBe(true)
    expect(t.initMs).toBeGreaterThanOrEqual(0)
  }, 60000)
})
