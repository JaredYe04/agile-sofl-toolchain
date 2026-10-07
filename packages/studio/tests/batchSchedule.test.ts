import { describe, it, expect, vi } from 'vitest'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const userData = mkdtempSync(join(tmpdir(), 'sched-ud-'))
writeFileSync(join(userData, 'llm-profiles.json'), JSON.stringify({ activeId: null, profiles: [] }))
vi.mock('electron', () => ({ app: { getPath: () => userData, getAppPath: () => userData }, ipcMain: { handle: () => undefined } }))

import { runBatch } from '../scripts/agent-harness/batch'
import { blockSchedule, mulberry32, parseSeed, stopDate } from '../scripts/agent-harness/schedule'

const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim()
const harnessDir = join(repo, 'packages', 'studio', 'scripts', 'agent-harness')
const SYS = ['classroom', 'delivery'], COND = ['T', 'B2', 'B0-auto'] as const
const pairs = SYS.flatMap((s) => COND.map((c) => `${s}/${c}`)).sort()

describe('seeded block-randomised schedule', () => {
  it('is deterministic per seed and differs between seeds', () => {
    expect(mulberry32(42)()).toBe(mulberry32(42)())
    const a = blockSchedule(SYS, [...COND], 5, 20261008), b = blockSchedule(SYS, [...COND], 5, 20261008)
    expect(a).toEqual(b)
    expect(blockSchedule(SYS, [...COND], 5, 20261009).map((x) => `${x.system}/${x.condition}`)).not.toEqual(a.map((x) => `${x.system}/${x.condition}`))
    expect(a.map((x) => x.order)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1))
    expect(() => parseSeed('-1')).toThrow(); expect(() => parseSeed('1.5')).toThrow(); expect(parseSeed('20261008')).toBe(20261008)
  })
  it('every consecutive block of 6 holds each (system, condition) pair exactly once, block k = repeat k', () => {
    for (const seed of [0, 1, 7, 20261008, 4294967295]) {
      const s = blockSchedule(SYS, [...COND], 5, seed)
      for (let b = 0; b < 5; b++) {
        const block = s.slice(b * 6, b * 6 + 6)
        expect(block.map((x) => `${x.system}/${x.condition}`).sort()).toEqual(pairs)
        expect(new Set(block.map((x) => x.repeat))).toEqual(new Set([b + 1]))
        expect(new Set(block.map((x) => x.block))).toEqual(new Set([b + 1]))
      }
    }
  })
  it('stopDate is the next local occurrence after the start', () => {
    const start = new Date(2026, 9, 8, 20, 0)
    expect(stopDate('08:00', start)).toEqual(new Date(2026, 9, 9, 8, 0))
    expect(stopDate('21:30', start)).toEqual(new Date(2026, 9, 8, 21, 30))
    expect(stopDate('20:00', start)).toEqual(new Date(2026, 9, 9, 20, 0))
    expect(() => stopDate('25:00', start)).toThrow(/HH:MM/)
  })
})

describe('batch stop-at and resume (dry run)', () => {
  const runIdsIn = (s: string, ids: string[]) => ids.filter((id) => s.includes(id))
  it('seed determinism end-to-end, stops at stop-at, resumes the same schedule, reruns a cut-off run', async () => {
    const realFetch = globalThis.fetch
    globalThis.fetch = (async () => { throw new Error('network must not be used') }) as typeof fetch
    process.env.ECNU_API_KEY ||= 'dry-run-placeholder'
    const base = mkdtempSync(join(tmpdir(), 'resume-'))
    try {
      // same seed -> same order -> (system, condition, repeat) in two independent batches; run ids differ
      const t0 = new Date(2026, 9, 8, 7, 56)
      let clock = t0.getTime()
      const now = () => new Date(clock)
      const tick = () => { clock += 60_000 }
      const common = { repo, systems: SYS, conditions: [...COND], repeats: 2, maxApprovals: 2, dryRun: true, harnessDir, seed: 20261008, log: () => {}, now }
      const out = join(base, 'out'), keyFile = join(base, 'keys', 'k.json')
      // runs start at 07:56, 07:57, 07:58, 07:59 -> at 08:00 no new run is started
      const r1 = await runBatch({ ...common, out, keyFile, stopAt: '08:00', afterRun: tick })
      expect(r1).toMatchObject({ status: 'interrupted', ok: 4, nextOrder: 5, total: 12, seed: 20261008 })
      const k1 = JSON.parse(readFileSync(keyFile, 'utf-8'))
      expect(k1).toMatchObject({ seed: 20261008, status: 'interrupted', nextOrder: 5, design: { type: 'block-randomised', blockSize: 6, blocks: 2, prng: 'mulberry32', seed: 20261008 } })
      expect(k1.interruptedAt).toMatch(/T08:00:00\.000[+-]\d\d:\d\d$/)
      expect(k1.stopReason).toMatch(/stop-at 08:00/)
      expect(k1.schedule.map((x: any) => [x.order, x.system, x.condition, x.repeat])).toEqual(blockSchedule(SYS, [...COND], 2, 20261008).map((x) => [x.order, x.system, x.condition, x.repeat]))
      const bj1 = JSON.parse(readFileSync(join(out, 'batch.json'), 'utf-8'))
      expect(bj1).toMatchObject({ status: 'interrupted', nextOrder: 5, runsDone: 4, sessions: 1 })
      expect(bj1.interruptedAt).toBe(k1.interruptedAt)

      // independent batch with the same seed: same order -> pair, fresh run ids
      const outB = join(base, 'outB'), keyB = join(base, 'keys', 'kB.json')
      await runBatch({ ...common, repeats: 1, out: outB, keyFile: keyB })
      const kB = JSON.parse(readFileSync(keyB, 'utf-8'))
      expect(kB.schedule.map((x: any) => `${x.system}/${x.condition}`)).toEqual(k1.schedule.slice(0, 6).map((x: any) => `${x.system}/${x.condition}`))
      expect(kB.schedule.map((x: any) => x.runId)).not.toEqual(k1.schedule.slice(0, 6).map((x: any) => x.runId))

      // simulate a run cut off mid-way at order 5 (process killed): status running + partial dirs
      const cut = k1.schedule[4]
      mkdirSync(join(out, 'runs', cut.runId), { recursive: true }); writeFileSync(join(out, 'runs', cut.runId, 'partial.txt'), 'x')
      mkdirSync(join(out, 'blinded', cut.runId, 'steps'), { recursive: true }); writeFileSync(join(out, 'blinded', cut.runId, 'steps', '1.asfl'), 'partial')
      k1.runs.push({ order: 5, runId: cut.runId, system: cut.system, condition: cut.condition, session: 1, attempt: 1, status: 'running' })
      writeFileSync(keyFile, JSON.stringify(k1, null, 2))

      // resume refuses if the harness changed
      const otherHarness = join(base, 'harness'); cpSync(harnessDir, otherHarness, { recursive: true })
      writeFileSync(join(otherHarness, 'extra.ts'), 'export {}\n')
      await expect(runBatch({ repo, keyFile, resume: true, dryRun: true, harnessDir: otherHarness, log: () => {} })).rejects.toMatchObject({ exitCode: 2 })
      // ... or if the recorded prompt hash does not match
      const tampered = join(base, 'keys', 'tampered.json')
      writeFileSync(tampered, JSON.stringify({ ...k1, promptHashes: { ...k1.promptHashes, classroom: 'deadbeef' } }))
      await expect(runBatch({ repo, keyFile: tampered, resume: true, dryRun: true, harnessDir, log: () => {} })).rejects.toThrow(/prompt hash of classroom changed/)
      // ... or a real resume of a dry batch
      await expect(runBatch({ repo, keyFile, resume: true, dryRun: false, harnessDir, log: () => {} })).rejects.toMatchObject({ exitCode: 2 })

      clock = new Date(2026, 9, 8, 20, 0).getTime()
      const r2 = await runBatch({ repo, keyFile, resume: true, dryRun: true, harnessDir, log: () => {}, now, stopAt: '08:00', afterRun: tick })
      expect(r2).toMatchObject({ status: 'finished', ok: 12, nextOrder: 13, session: 2 })
      const k2 = JSON.parse(readFileSync(keyFile, 'utf-8'))
      expect(k2.sessions.map((s: any) => [s.session, s.startOrder, s.nextOrder, s.runsDone, s.endReason])).toEqual([[1, 1, 5, 4, 'stop-at 08:00 reached'], [2, 5, 13, 8, 'all scheduled runs done']])
      for (const s of k2.sessions) { expect(s.startedAt).toBeTruthy(); expect(s.endedAt).toBeTruthy() }
      expect(k2.runs.map((r: any) => r.order).sort((a: number, b: number) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1))
      expect(k2.runs.every((r: any) => r.status === 'ok')).toBe(true)
      expect(k2.runs.filter((r: any) => r.session === 1).length).toBe(4)
      expect(k2.runs.filter((r: any) => r.session === 2).length).toBe(8)
      const rerun = k2.runs.find((r: any) => r.order === 5)
      expect(rerun).toMatchObject({ runId: cut.runId, attempt: 2, session: 2, status: 'ok' })
      expect(rerun.previousAttempts[0]).toMatchObject({ status: 'running', movedTo: `aborted/${cut.runId}-a1` })
      expect(readFileSync(join(out, 'aborted', `${cut.runId}-a1`, 'run', 'partial.txt'), 'utf-8')).toBe('x')
      expect(existsSync(join(out, 'aborted', `${cut.runId}-a1`, 'blinded', 'steps', '1.asfl'))).toBe(true)
      expect(existsSync(join(out, 'runs', cut.runId, 'partial.txt'))).toBe(false)
      expect(existsSync(join(out, 'blinded', cut.runId, 'final.asfl'))).toBe(true)
      const abortedLog = readFileSync(join(out, 'aborted', 'aborted.log'), 'utf-8')
      expect(abortedLog).toMatch(new RegExp(`run=${cut.runId} order=5 attempt=1 cut off mid-run`))
      expect(abortedLog).not.toMatch(/B0-auto|B2|classroom|delivery|session/)
      // blinded dir has exactly the scheduled run ids
      expect(readdirSync(join(out, 'blinded')).sort()).toEqual(k2.schedule.map((x: any) => x.runId).sort())

      // nothing under out/ reveals the seed, schedule or per-run session/condition
      const bj2 = JSON.parse(readFileSync(join(out, 'batch.json'), 'utf-8'))
      expect(bj2).toMatchObject({ status: 'finished', runsDone: 12, sessions: 2, nextOrder: 13 })
      expect(bj2.interruptions).toEqual([{ at: k1.interruptedAt, nextOrder: 5, runsDone: 4, reason: 'stop-at 08:00 reached' }])
      const bjText = readFileSync(join(out, 'batch.json'), 'utf-8')
      expect(bjText).not.toMatch(/20261008|"seed"|"schedule"|"session"|"condition"/)
      expect(runIdsIn(bjText, k2.schedule.map((x: any) => x.runId))).toEqual([])
      for (const f of ['batch.json', 'retries.log']) if (existsSync(join(out, f))) expect(readFileSync(join(out, f), 'utf-8')).not.toMatch(/20261008/)
      for (const r of k2.runs) {
        const m = readFileSync(join(out, 'runs', r.runId, 'manifest.json'), 'utf-8')
        expect(m).not.toMatch(/"seed"|"session"|"schedule"/)
      }
      // finished batches cannot be resumed again
      await expect(runBatch({ repo, keyFile, resume: true, dryRun: true, harnessDir, log: () => {} })).rejects.toThrow(/already finished/)
    } finally { globalThis.fetch = realFetch }
  }, 240000)
})
