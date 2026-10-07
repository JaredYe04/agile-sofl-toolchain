import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const userData = mkdtempSync(join(tmpdir(), 'retry-ud-'))
writeFileSync(join(userData, 'llm-profiles.json'), JSON.stringify({ activeId: null, profiles: [] }))
vi.mock('electron', () => ({ app: { getPath: () => userData, getAppPath: () => userData }, ipcMain: { handle: () => undefined } }))

import { install429Retry, setRetryContext } from '../scripts/agent-harness/core'

describe('retries.log', () => {
  it('logs every 429/503 retry with time, run id, order and attempt (no condition)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'retry-'))
    const statuses = [429, 503, 200, 429, 429, 429]
    const realFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response('x', { status: statuses.shift() ?? 200 })) as typeof fetch
    try {
      install429Retry(join(dir, 'retries.log'), 2, 1)
      setRetryContext(() => ({ run: 'abcd1234', order: 7 }))
      expect((await fetch('http://x')).status).toBe(200)
      expect((await fetch('http://x')).status).toBe(429) // gives up after 2 retries
      const lines = readFileSync(join(dir, 'retries.log'), 'utf-8').trim().split('\n')
      expect(lines).toHaveLength(6)
      for (const l of lines) expect(l).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}[+-]\d\d:\d\d run=abcd1234 order=7 attempt=\d+ status=\d+/)
      expect(lines[0]).toMatch(/attempt=1 status=429 retry=1\/2 wait=\d+ms/)
      expect(lines[1]).toMatch(/attempt=2 status=503 retry=2\/2/)
      expect(lines[2]).toMatch(/attempt=3 status=200 recovered/)
      expect(lines[5]).toMatch(/attempt=3 status=429 giving-up/)
      expect(readFileSync(join(dir, 'retries.log'), 'utf-8')).not.toMatch(/B0-auto|B2|condition|\bT\b/)
    } finally { globalThis.fetch = realFetch; setRetryContext(() => ({})) }
  })
})

