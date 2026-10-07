import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const cli = join(root, 'dist', 'cli.js')
const banking = join(root, 'tests', 'fixtures', 'integration', 'banking.asfl')

describe('CLI check startup (regression: `asfl check` appeared to hang)', () => {
  it('returns within 15 s and reports parse status', () => {
    const t0 = Date.now()
    const r = spawnSync('node', [cli, 'check', banking], { encoding: 'utf-8', timeout: 15000 })
    const elapsed = Date.now() - t0
    expect(r.error).toBeUndefined()
    expect(r.signal).toBeNull()
    expect(r.stdout).toContain('Agile-SOFL Inspect')
    expect(elapsed).toBeLessThan(15000)
  }, 20000)

  it('constructs both parser instances quickly (no exponential LL(k) analysis)', async () => {
    const t0 = Date.now()
    const r = spawnSync('node', ['-e', `require(${JSON.stringify(join(root, 'dist', 'parser', 'parser.js'))})`], { timeout: 15000 })
    expect(r.status).toBe(0)
    expect(Date.now() - t0).toBeLessThan(10000)
  }, 20000)
})
