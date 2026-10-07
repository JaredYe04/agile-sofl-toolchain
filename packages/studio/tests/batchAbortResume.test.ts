import { it, expect, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const userData = mkdtempSync(join(tmpdir(), 'abort-ud-'))
writeFileSync(join(userData, 'llm-profiles.json'), JSON.stringify({ activeId: null, profiles: [] }))
vi.mock('electron', () => ({ app: { getPath: () => userData, getAppPath: () => userData }, ipcMain: { handle: () => undefined } }))
const failing = new Set<number>()
let call = 0
vi.mock('../scripts/agent-harness/b0auto', async (orig) => {
  const real = await orig<typeof import('../scripts/agent-harness/b0auto')>()
  return {
    ...real,
    runB0Auto: (o: { outDir: string; runId: string }) => {
      call++
      if (failing.has(call)) { mkdirSync(join(o.outDir, 'runs', o.runId), { recursive: true }); throw new Error(`simulated outage #${call}`) }
      return real.runB0Auto(o as never)
    }
  }
})
import { runBatch } from '../scripts/agent-harness/batch'

const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim()
const harnessDir = join(repo, 'packages', 'studio', 'scripts', 'agent-harness')

it('3 consecutive errors abort the session; resume reruns the failed streak (moved to aborted/)', async () => {
  const base = mkdtempSync(join(tmpdir(), 'abort-'))
  const out = join(base, 'out'), keyFile = join(base, 'keys', 'k.json')
  failing.add(2).add(3).add(4)
  await expect(runBatch({ repo, systems: ['delivery'], conditions: ['B0-auto'], repeats: 5, maxApprovals: 1, out, keyFile, dryRun: true, harnessDir, seed: 1, log: () => {} }))
    .rejects.toThrow(/batch aborted.*--resume/)
  const k1 = JSON.parse(readFileSync(keyFile, 'utf-8'))
  expect(k1).toMatchObject({ status: 'aborted', nextOrder: 2 })
  expect(JSON.parse(readFileSync(join(out, 'batch.json'), 'utf-8'))).toMatchObject({ status: 'aborted', nextOrder: 2, runsDone: 1 })
  failing.clear()
  const r = await runBatch({ repo, keyFile, resume: true, dryRun: true, harnessDir, log: () => {} })
  expect(r).toMatchObject({ status: 'finished', ok: 5 })
  const k2 = JSON.parse(readFileSync(keyFile, 'utf-8'))
  for (const order of [2, 3, 4]) {
    const e = k2.runs.find((x: any) => x.order === order)
    expect(e).toMatchObject({ attempt: 2, session: 2, status: 'ok' })
    expect(existsSync(join(out, 'aborted', `${e.runId}-a1`, 'run'))).toBe(true)
  }
  expect(readFileSync(join(out, 'aborted', 'aborted.log'), 'utf-8').trim().split('\n')).toHaveLength(3)
}, 120000)
