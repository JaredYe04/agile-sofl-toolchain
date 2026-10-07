import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const userData = mkdtempSync(join(tmpdir(), 'batch-ud-'))
writeFileSync(join(userData, 'llm-profiles.json'), JSON.stringify({ activeId: null, profiles: [] }))
vi.mock('electron', () => ({ app: { getPath: () => userData, getAppPath: () => userData }, ipcMain: { handle: () => undefined } }))

import { runBatch, SYSTEMS } from '../scripts/agent-harness/batch'
import { runB0Auto } from '../scripts/agent-harness/b0auto'
import { freezeStatus, isInside, TOOL_PATHS } from '../scripts/agent-harness/freeze'
import { aggregateSteps, recordStep, STEP_CSV_COLUMNS, type StepRecord } from '../scripts/agent-harness/steps'

const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim()
const harnessDir = join(repo, 'packages', 'studio', 'scripts', 'agent-harness')

describe('freeze guard', () => {
  it('passes when no tool file differs from the tag and fails otherwise', () => {
    const fake = (changed: string) => (args: string[]) => args[0] === 'rev-parse' ? 'abc123' : args[0] === 'diff' ? changed : ''
    const ok = freezeStatus(repo, fake(''))
    expect(ok.changedToolFiles).toEqual([])
    expect(ok.reasons.filter((r) => /tool source/.test(r))).toEqual([])
    const bad = freezeStatus(repo, fake('packages/parser/src/fsf/l2Check.ts'))
    expect(bad.ok).toBe(false)
    expect(bad.reasons.join(' ')).toMatch(/tool source differs/)
    expect(TOOL_PATHS).toContain('packages/studio/src')
  })
  it('isInside', () => {
    expect(isInside(resolve('/a/b/k.json'), resolve('/a/b'))).toBe(true)
    expect(isInside(resolve('/a/k.json'), resolve('/a/b'))).toBe(false)
  })
})

describe('B0-auto', () => {
  it('is deterministic and needs no LLM', () => {
    const out = mkdtempSync(join(tmpdir(), 'b0-'))
    const inf = join(repo, SYSTEMS.delivery!)
    const a = runB0Auto({ informalPath: inf, outDir: out, runId: 'aaaa' })
    const b = runB0Auto({ informalPath: inf, outDir: out, runId: 'bbbb' })
    expect(readFileSync(join(a.runDir, 'hybrid.asfl'), 'utf-8')).toBe(readFileSync(join(b.runDir, 'hybrid.asfl'), 'utf-8'))
    expect(JSON.parse(readFileSync(join(a.runDir, 'manifest.json'), 'utf-8'))).toMatchObject({ llmCalls: 0, runId: 'aaaa' })
  })
})

describe('batch runner', () => {
  it('dry run: no network, blinded ids, key outside outputs, provenance + prompt hash per system', async () => {
    const realFetch = globalThis.fetch
    globalThis.fetch = (async () => { throw new Error('network must not be used') }) as typeof fetch
    process.env.ECNU_API_KEY ||= 'dry-run-placeholder'
    const base = mkdtempSync(join(tmpdir(), 'batch-'))
    const out = join(base, 'out'), keyFile = join(base, 'keys', 'k.json')
    try {
      await expect(runBatch({ repo, systems: ['delivery'], conditions: ['T'], repeats: 1, maxApprovals: 1, out, keyFile: join(out, 'k.json'), dryRun: true, harnessDir, log: () => {} }))
        .rejects.toThrow(/outside --out/)
      const r = await runBatch({ repo, systems: ['classroom', 'delivery'], conditions: ['T', 'B2', 'B0-auto'], repeats: 1, maxApprovals: 2, out, keyFile, dryRun: true, harnessDir, log: () => {} })
      expect(r.total).toBe(6)
      expect(r.ok).toBe(6)
      const key = JSON.parse(readFileSync(keyFile, 'utf-8'))
      expect(key.runs.map((x: any) => x.condition).sort()).toEqual(['B0-auto', 'B0-auto', 'B2', 'B2', 'T', 'T'])
      for (const sys of ['classroom', 'delivery']) {
        const hs = key.runs.filter((x: any) => x.system === sys && x.condition !== 'B0-auto').map((x: any) => x.promptHash)
        expect(new Set(hs).size).toBe(1)
      }
      expect(readdirSync(join(out, 'blinded')).sort()).toEqual(key.runs.map((x: any) => x.runId).sort())
      for (const run of key.runs) {
        const runDir = join(out, 'runs', run.runId), bl = join(out, 'blinded', run.runId)
        const m = JSON.parse(readFileSync(join(runDir, 'manifest.json'), 'utf-8'))
        expect(m.toolCommit).toMatch(/^[0-9a-f]{40}$/)
        expect(m).toMatchObject({ freezeTag: 'exp-freeze-v1.2', dryRun: true, maxApprovals: 2 })
        // per-step snapshots: one per approved step (budget 2), B0-auto exactly one
        const n = run.condition === 'B0-auto' ? 1 : 2
        expect(run.steps).toBe(n)
        if (run.condition !== 'B0-auto') expect(m.approvals).toBe(2)
        const names = Array.from({ length: n }, (_, i) => `${i + 1}.asfl`)
        expect(readdirSync(join(runDir, 'steps')).sort()).toEqual(names)
        expect(readdirSync(join(bl, 'steps')).sort()).toEqual(names)
        expect(readFileSync(join(bl, 'final.asfl'), 'utf-8')).toBe(readFileSync(join(runDir, 'hybrid.asfl'), 'utf-8'))
        expect(readFileSync(join(bl, 'steps', `${n}.asfl`), 'utf-8')).toBe(readFileSync(join(runDir, 'hybrid.asfl'), 'utf-8'))
        if (n === 2) expect(readFileSync(join(runDir, 'steps', '1.asfl'), 'utf-8')).not.toBe(readFileSync(join(runDir, 'steps', '2.asfl'), 'utf-8'))
        const rows = readFileSync(join(runDir, 'steps.jsonl'), 'utf-8').trim().split('\n').map((l) => JSON.parse(l))
        expect(rows.map((x: any) => x.step)).toEqual(names.map((_, i) => i + 1))
        for (const row of rows) for (const k of ['parserErrors', 'parserWarnings', 'l1Errors', 'l1Warnings', 'l2Errors', 'l2Warnings']) expect(typeof row[k]).toBe('number')
        const csv = readFileSync(join(runDir, 'steps.csv'), 'utf-8').trim().split('\n')
        expect(csv[0]).toBe(STEP_CSV_COLUMNS.join(','))
        expect(csv).toHaveLength(n + 1)
        // the last snapshot's counts equal the final diagnostics (same full checker)
        const fd = JSON.parse(readFileSync(join(runDir, 'final-diagnostics.json'), 'utf-8'))
        expect([rows[n - 1].parserErrors, rows[n - 1].l1Errors, rows[n - 1].l2Errors]).toEqual([fd.parser.error, fd.l1.error, fd.l2.error])
        expect(m.harnessSha256).toMatch(/^[0-9a-f]{64}$/)
        expect(existsSync(join(out, 'runs', run.runId, 'final-diagnostics.json'))).toBe(true)
      }
      const batchJson = readFileSync(join(out, 'batch.json'), 'utf-8')
      expect(batchJson).not.toMatch(/"condition"/)
      const bj = JSON.parse(batchJson)
      expect(JSON.stringify(bj.stepSummary)).not.toMatch(/B0-auto|B2|"T"|classroom|delivery|[0-9a-f]{8}/)
      expect(bj.maxApprovals).toBe(2)
      expect(bj.stepSummary.map((s: any) => [s.step, s.runs])).toEqual([[1, 6], [2, 4]])
      expect(Object.keys(key.stepSummaryByGroup).sort()).toEqual(['classroom/B0-auto', 'classroom/B2', 'classroom/T', 'delivery/B0-auto', 'delivery/B2', 'delivery/T'])
      expect(key.stepSummaryByGroup['delivery/B0-auto']).toHaveLength(1)
      expect(readdirSync(out)).not.toContain('k.json')
    } finally { globalThis.fetch = realFetch }
  }, 120000)

  it('recordStep writes snapshots + jsonl/csv, aggregateSteps averages over runs reaching each step', async () => {
    const base = mkdtempSync(join(tmpdir(), 'steps-'))
    const runDir = join(base, 'runs', 'r1'), blindedDir = join(base, 'blinded', 'r1')
    const counts = async (asfl: string) => ({ parser: { error: asfl.length % 2, warning: 1 }, l1: { error: 2, warning: 0, enabled: true, ran: true }, l2: { error: 0, warning: 3, enabled: true, ran: true } })
    const a = await recordStep({ runDir, blindedDir, counts }, { step: 1, hybrid: 'x', tool: 'propose_hybrid_changes', applied: true })
    const b = await recordStep({ runDir, blindedDir, counts }, { step: 2, hybrid: 'xy', tool: 'propose_hybrid_changes', applied: false, applyError: 'boom' })
    expect(readFileSync(join(blindedDir, 'steps', '2.asfl'), 'utf-8')).toBe('xy')
    expect(b).toMatchObject({ step: 2, applied: false, applyError: true, parserErrors: 0, l1Errors: 2, l2Warnings: 3, chars: 2 })
    expect(readFileSync(join(runDir, 'steps.csv'), 'utf-8').trim().split('\n')).toHaveLength(3)
    const c: StepRecord = { ...a, l1Errors: 0, parserErrors: 0 }
    const agg = aggregateSteps([[a, b], [c]])
    expect(agg).toHaveLength(2)
    expect(agg[0]).toMatchObject({ step: 1, runs: 2, parsed: 2, zeroErrorRuns: 1, mean: { parserErrors: 0.5, l1Errors: 1, l2Warnings: 3 } })
    expect(agg[1]).toMatchObject({ step: 2, runs: 1, mean: { l1Errors: 2 } })
  })

  it('refuses a real (non-dry) batch when the tool source differs from exp-freeze-v1.2', async () => {
    const st = freezeStatus(repo)
    if (st.ok) return // running on the freeze commit itself
    const base = mkdtempSync(join(tmpdir(), 'batch-'))
    await expect(runBatch({ repo, systems: ['delivery'], conditions: ['T'], repeats: 1, maxApprovals: 1, out: join(base, 'o'), keyFile: join(base, 'k.json'), dryRun: false, harnessDir, log: () => {} }))
      .rejects.toMatchObject({ exitCode: 2 })
    expect(existsSync(join(base, 'o'))).toBe(false)
  })
})
