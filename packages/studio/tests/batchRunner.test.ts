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
      const r = await runBatch({ repo, systems: ['classroom', 'delivery'], conditions: ['T', 'B2', 'B0-auto'], repeats: 1, maxApprovals: 1, out, keyFile, dryRun: true, harnessDir, log: () => {} })
      expect(r.total).toBe(6)
      expect(r.ok).toBe(6)
      const key = JSON.parse(readFileSync(keyFile, 'utf-8'))
      expect(key.runs.map((x: any) => x.condition).sort()).toEqual(['B0-auto', 'B0-auto', 'B2', 'B2', 'T', 'T'])
      for (const sys of ['classroom', 'delivery']) {
        const hs = key.runs.filter((x: any) => x.system === sys && x.condition !== 'B0-auto').map((x: any) => x.promptHash)
        expect(new Set(hs).size).toBe(1)
      }
      expect(readdirSync(join(out, 'blinded')).sort()).toEqual(key.runs.map((x: any) => `${x.runId}.asfl`).sort())
      for (const run of key.runs) {
        const m = JSON.parse(readFileSync(join(out, 'runs', run.runId, 'manifest.json'), 'utf-8'))
        expect(m.toolCommit).toMatch(/^[0-9a-f]{40}$/)
        expect(m).toMatchObject({ freezeTag: 'exp-freeze-v1.2', dryRun: true })
        expect(m.harnessSha256).toMatch(/^[0-9a-f]{64}$/)
        expect(existsSync(join(out, 'runs', run.runId, 'final-diagnostics.json'))).toBe(true)
      }
      const batchJson = readFileSync(join(out, 'batch.json'), 'utf-8')
      expect(batchJson).not.toMatch(/"condition"/)
      expect(readdirSync(out)).not.toContain('k.json')
    } finally { globalThis.fetch = realFetch }
  }, 120000)

  it('refuses a real (non-dry) batch when the tool source differs from exp-freeze-v1.2', async () => {
    const st = freezeStatus(repo)
    if (st.ok) return // running on the freeze commit itself
    const base = mkdtempSync(join(tmpdir(), 'batch-'))
    await expect(runBatch({ repo, systems: ['delivery'], conditions: ['T'], repeats: 1, maxApprovals: 1, out: join(base, 'o'), keyFile: join(base, 'k.json'), dryRun: false, harnessDir, log: () => {} }))
      .rejects.toMatchObject({ exitCode: 2 })
    expect(existsSync(join(base, 'o'))).toBe(false)
  })
})
