import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const userData = mkdtempSync(join(tmpdir(), 'case-sim-ud-'))
writeFileSync(join(userData, 'llm-profiles.json'), JSON.stringify({ activeId: null, profiles: [] }))
process.env.AGILE_SOFL_HARNESS_USERDATA = userData
vi.mock('electron', () => ({ app: { getPath: () => userData, getAppPath: () => userData }, ipcMain: { handle: () => undefined } }))

import { HELP, MAX_WORKERS, FORM_VERSION, PILOT_IDS } from '../scripts/case-study-sim/constants'
import { parseArgs, runCli } from '../scripts/case-study-sim/run'
import { requireFreeze, freezeRefuse, type FreezeStatus } from '../scripts/case-study-sim/freeze-guard'
import { loadSimEnv, resolveApiKey, missingKeyError } from '../scripts/case-study-sim/env'
import { clampConcurrency, mapPool } from '../scripts/case-study-sim/pool'
import { loadSubjects, selectSubjects } from '../scripts/case-study-sim/subjects'
import { experienceFromFacts } from '../scripts/case-study-sim/experience'
import { buildSubjectFacts, clarificationsFromEvents } from '../scripts/case-study-sim/facts'
import { resolveFromFacts } from '../scripts/case-study-sim/oracle'
import { runCaseStudyBatch } from '../scripts/case-study-sim/batch'
import { PILOT_TEMPERATURE, UNMATCHED_CLARIFICATION_REPLY } from '../scripts/agent-harness/core'
import type { SessionEvent, SubjectFacts } from '../scripts/case-study-sim/types'

const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim()
const assetsDir = join(repo, 'packages', 'studio', 'scripts', 'case-study-sim')

const okFreeze = (): FreezeStatus => ({
  ok: true,
  head: 'a'.repeat(40),
  freezeTag: 'exp-freeze-v1.2',
  freezeCommit: 'a'.repeat(40),
  changedToolFiles: [],
  staleDist: [],
  reasons: []
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('case-study-sim CLI / env', () => {
  it('--help works without a key and without freeze', async () => {
    delete process.env.ECNU_API_KEY
    delete process.env.ecnu_api_key
    const r = await runCli(['--help'])
    expect(r.code).toBe(0)
    expect(parseArgs(['--help']).help).toBe(true)
    expect(HELP).toMatch(/exp-freeze-v1\.2/)
    expect(HELP).toMatch(/3 concurrent/)
  })

  it('parseArgs: --pilot, --subjects, concurrency clamp', () => {
    expect(parseArgs(['--pilot']).mode).toBe('pilot')
    expect(parseArgs(['--expand']).mode).toBe('expand')
    expect(parseArgs(['--subjects', 'P4,P5']).subjectIds).toEqual(['P4', 'P5'])
    expect(parseArgs(['--concurrency', '9']).concurrency).toBe(MAX_WORKERS)
    expect(parseArgs(['--dry-run', '--pilot']).dryRun).toBe(true)
  })

  it('missing key message names .env.ecnu', () => {
    expect(missingKeyError().message).toMatch(/\.env\.ecnu/)
    expect(missingKeyError().message).toMatch(/ECNU_API_KEY/)
  })

  it('loads ECNU_API_KEY and lowercase ecnu_api_key from a file', () => {
    const prev = process.env.ECNU_API_KEY
    delete process.env.ECNU_API_KEY
    delete process.env.ecnu_api_key
    const f = join(mkdtempSync(join(tmpdir(), 'env-')), '.env.ecnu')
    writeFileSync(f, 'ecnu_api_key=from-file-not-a-real-key\nECNU_MODEL=ecnu-max\n')
    loadSimEnv([f])
    expect(resolveApiKey()).toBe('from-file-not-a-real-key')
    delete process.env.ECNU_API_KEY
    delete process.env.ecnu_api_key
    if (prev) process.env.ECNU_API_KEY = prev
  })
})

describe('freeze guard', () => {
  it('CLI --dry-run on a non-freeze checkout exits 2 before needing a key', async () => {
    const { freezeStatus } = await import('../scripts/case-study-sim/freeze-guard')
    const st = freezeStatus(repo)
    if (st.ok) return
    delete process.env.ECNU_API_KEY
    await expect(runCli(['--dry-run', '--subjects', 'P4'])).rejects.toMatchObject({ exitCode: 2 })
  })

  it('refuses off-freeze with exit 2, including dry-run', () => {
    const bad: FreezeStatus = {
      ok: false,
      head: 'bbbb',
      freezeTag: 'exp-freeze-v1.2',
      freezeCommit: 'aaaa',
      changedToolFiles: ['packages/studio/src/main/services/llm/agentLoop.ts'],
      staleDist: [],
      reasons: ['tool source differs from exp-freeze-v1.2 in 1 file(s)']
    }
    try {
      requireFreeze(bad, true)
      throw new Error('expected refuse')
    } catch (e) {
      expect((e as { exitCode?: number }).exitCode).toBe(2)
      expect((e as Error).message).toMatch(/freeze check FAILED/)
    }
    expect(freezeRefuse('x')).toMatchObject({ exitCode: 2 })
  })
})

describe('subjects table', () => {
  it('loads P4–P23 with pilot P4–P6 fully specified', () => {
    const all = loadSubjects(assetsDir)
    expect(all).toHaveLength(20)
    expect(all.map((s) => s.id)).toEqual(Array.from({ length: 20 }, (_, i) => `P${i + 4}`))
    const p4 = all.find((s) => s.id === 'P4')!
    expect(p4).toMatchObject({
      domain: '游戏引擎/渲染',
      yearsSpecWork: '5to10',
      task: 'greenfield',
      project: 'Project-RenderCore',
      initialModel: '场景图/资源/主循环',
      extension: '热重载与多线程调度'
    })
    const p6 = all.find((s) => s.id === 'P6')!
    expect(p6.task).toBe('extension')
    expect(p6.seedHybridFile).toMatch(/P6-FactoryMES-LineA/)
    expect(p6.authorizedFacts.length).toBeGreaterThan(0)
    const waves = selectSubjects(all, 'all')
    expect(waves[0]!.map((s) => s.id)).toEqual([...PILOT_IDS])
    expect(waves[1]!.map((s) => s.id)[0]).toBe('P7')
    expect(waves[1]).toHaveLength(17)
  })
})

describe('concurrency cap', () => {
  it('mapPool never exceeds 3 overlapping workers', async () => {
    expect(clampConcurrency(99)).toBe(3)
    let current = 0
    let max = 0
    await mapPool(
      Array.from({ length: 8 }, (_, i) => i),
      9,
      async () => {
        current++
        max = Math.max(max, current)
        await new Promise((r) => setTimeout(r, 40))
        current--
      }
    )
    expect(max).toBeLessThanOrEqual(3)
    expect(max).toBe(3)
  })
})

describe('oracle ≥1 keyword hits', () => {
  it('joins all authorized facts when a question names several domains', () => {
    const p4 = loadSubjects(assetsDir).find((s) => s.id === 'P4')!
    const resolve = resolveFromFacts(p4.authorizedFacts)
    const r = resolve({ question: '场景图/资源/主循环怎么划分模块？' })
    expect(r.unmatched).toBe(false)
    expect(r.matchedSlotIds).toEqual(expect.arrayContaining(['scene-graph', 'assets', 'loop']))
    expect(r.matchedSlotIds.length).toBeGreaterThanOrEqual(2)
    expect(r.text).toContain('场景图是变换/网格/相机/灯光节点树。')
    expect(r.text).toContain('资源覆盖网格、纹理、着色器，按引用计数加载卸载。')
    expect(r.text).toContain('主循环顺序为输入 → 更新 → 渲染。')
    expect(r.text).toMatch(/\n/)
  })

  it('stays unmatched when nothing in the task packet hits', () => {
    const p4 = loadSubjects(assetsDir).find((s) => s.id === 'P4')!
    const resolve = resolveFromFacts(p4.authorizedFacts)
    const r = resolve({ question: 'Who may export payroll to an unnamed third party?' })
    expect(r.unmatched).toBe(true)
    expect(r.matchedSlotIds ?? []).toEqual([])
    expect(r.text).toBe(UNMATCHED_CLARIFICATION_REPLY)
  })
})

describe('experience.json from session facts only', () => {
  it('fills nested P1-style feedback from events, without invented quotes', () => {
    const p4 = loadSubjects(assetsDir).find((s) => s.id === 'P4')!
    const events: SessionEvent[] = [
      { at: 't0', phase: 'informal', type: 'clarification_asked', question: '场景图/资源/主循环怎么划分？' },
      {
        at: 't1',
        phase: 'informal',
        type: 'oracle_reply',
        question: '场景图/资源/主循环怎么划分？',
        matched: true,
        unmatched: false,
        matchedSlotIds: ['scene-graph', 'assets', 'loop'],
        answerPreview: '场景图是变换/网格/相机/灯光节点树。'
      },
      {
        at: 't2',
        phase: 'informal',
        type: 'proposal',
        tool: 'propose_changes',
        applied: true,
        explanation: 'add scene graph function',
        target: 'informal',
        opKinds: ['add']
      },
      {
        at: 't3',
        phase: 'hybrid',
        type: 'proposal',
        tool: 'propose_hybrid_changes',
        applied: false,
        applyError: 'duplicate module',
        explanation: 'add SYSTEM_RenderCore',
        target: 'hybrid',
        opKinds: ['add']
      }
    ]
    const facts: SubjectFacts = buildSubjectFacts({
      subject: p4,
      startedAt: '2026-10-29T01:00:00.000+00:00',
      endedAt: '2026-10-29T01:05:00.000+00:00',
      dryRun: false,
      modelAlias: 'ecnu-max',
      modelId: 'deepseek-v4-flash',
      temperature: PILOT_TEMPERATURE,
      phases: [
        {
          phase: 'informal',
          skillId: 'requirement-discovery',
          approvals: 1,
          clarificationsAnswered: 1,
          clarificationsMatched: 1,
          clarificationsUnmatched: 0,
          stopReason: 'agent finished',
          tools: ['propose_changes']
        },
        {
          phase: 'hybrid',
          skillId: 'hybrid-generation',
          approvals: 1,
          clarificationsAnswered: 0,
          clarificationsMatched: 0,
          clarificationsUnmatched: 0,
          stopReason: 'approval budget reached',
          tools: ['propose_hybrid_changes']
        }
      ],
      events,
      informalChars: 120,
      hybridChars: 40,
      guiChars: 10
    })
    expect(clarificationsFromEvents(events)).toHaveLength(1)
    expect(facts.proposals).toHaveLength(2)
    const exp = experienceFromFacts(facts)
    expect(exp).toMatchObject({
      formVersion: FORM_VERSION,
      participantId: 'P4',
      domain: '游戏引擎/渲染',
      yearsSpecWork: '5to10',
      task: 'greenfield',
      initialModel: '场景图/资源/主循环',
      extension: '热重载与多线程调度',
      screenshotsPrepared: false
    })
    expect(exp.feedback).toEqual(
      expect.objectContaining({
        mostHelpful: expect.any(String),
        mostDifficult: expect.any(String),
        suggestion: expect.any(String)
      })
    )
    expect(exp.feedback.mostHelpful).toMatch(/propose_changes/)
    expect(exp.feedback.mostHelpful).toMatch(/场景图\/资源\/主循环/)
    expect(exp.feedback.mostHelpful).toMatch(/scene-graph/)
    expect(exp.feedback.mostDifficult).toMatch(/duplicate module|写入失败/)
    expect(exp.feedback.mostDifficult).toMatch(/budget/)
    expect(exp.feedback.suggestion).toMatch(/propose_source_edit|预算/)
    expect(exp.probe).toMatch(/场景图\/资源\/主循环/)
    expect(exp.probe).not.toMatch(/^按任务包做了/)
    expect(JSON.stringify(exp)).not.toMatch(/我觉得|非常好用|participant said/)
  })
})

describe('dry-run P4 layout', () => {
  it('produces meta.json + experience.json matching the case-study shape', async () => {
    process.env.ECNU_API_KEY = 'dry-run-placeholder'
    const realFetch = globalThis.fetch
    const out = join(mkdtempSync(join(tmpdir(), 'case-sim-out-')), 'out')
    try {
    const r = await runCaseStudyBatch({
      repo,
      out,
      mode: 'pilot',
      dryRun: true,
      concurrency: 3,
      maxApprovals: 2,
      assetsDir,
      freeze: okFreeze(),
      log: () => {}
    })
    expect(r.ok).toBe(3)
    expect(r.total).toBe(3)
    expect(r.results.map((x) => x.id).sort()).toEqual(['P4', 'P5', 'P6'])
    for (const id of ['P4', 'P5', 'P6']) {
      expect(existsSync(join(out, id, 'meta.json'))).toBe(true)
      expect(existsSync(join(out, id, 'experience.json'))).toBe(true)
      expect(JSON.parse(readFileSync(join(out, id, 'meta.json'), 'utf-8')).subjectType).toBe('agent-simulated')
    }
    const dir = join(out, 'P4')
    expect(existsSync(join(dir, 'meta.json'))).toBe(true)
    expect(existsSync(join(dir, 'experience.json'))).toBe(true)
    expect(existsSync(join(dir, 'informal.aspec'))).toBe(true)
    expect(existsSync(join(dir, 'hybrid.asfl'))).toBe(true)
    expect(existsSync(join(dir, 'session', 'events.jsonl'))).toBe(true)
    expect(existsSync(join(dir, 'artifacts', 'informal.aspec'))).toBe(true)
    expect(existsSync(join(dir, 'materials', 'task-brief.md'))).toBe(true)
    const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf-8'))
    expect(meta).toMatchObject({
      subjectType: 'agent-simulated',
      participantId: 'P4',
      temperature: 0.35,
      toolchainTag: 'exp-freeze-v1.2',
      dryRun: true
    })
    expect(meta.toolchainCommit).toMatch(/^[a-f0-9]+$/)
    expect(meta.timeWindow.startedAt).toBeTruthy()
    expect(meta.timeWindow.endedAt).toBeTruthy()
    expect(meta.materialsComplete).toBe(true)
    const exp = JSON.parse(readFileSync(join(dir, 'experience.json'), 'utf-8'))
    expect(exp.formVersion).toBe(FORM_VERSION)
    expect(exp.screenshotsPrepared).toBe(false)
    expect(exp.feedback).toEqual(
      expect.objectContaining({
        mostHelpful: expect.any(String),
        mostDifficult: expect.any(String),
        suggestion: expect.any(String)
      })
    )
    expect(exp.feedback.mostHelpful).toMatch(/场景图\/资源\/主循环|propose_/)
    expect(exp.feedback.suggestion).toMatch(/dry-run|截图/)
    expect(typeof exp.feedback).not.toBe('string')
    const blob = readFileSync(join(dir, 'experience.json'), 'utf-8') + readFileSync(join(dir, 'meta.json'), 'utf-8')
    expect(blob).not.toContain('dry-run-placeholder')
    expect(blob).not.toMatch(/sk-[a-zA-Z0-9]{8,}/)
    } finally {
      globalThis.fetch = realFetch
    }
  }, 120000)

  it('injected failed freeze refuses the batch with exit 2', async () => {
    await expect(
      runCaseStudyBatch({
        repo,
        out: join(mkdtempSync(join(tmpdir(), 'case-sim-fz-')), 'out'),
        mode: 'ids',
        subjectIds: ['P4'],
        dryRun: true,
        concurrency: 1,
        assetsDir,
        freeze: {
          ok: false,
          head: 'x',
          freezeTag: 'exp-freeze-v1.2',
          freezeCommit: 'y',
          changedToolFiles: ['packages/studio/src/foo.ts'],
          staleDist: [],
          reasons: ['tool source differs from exp-freeze-v1.2 in 1 file(s)']
        },
        log: () => {}
      })
    ).rejects.toMatchObject({ exitCode: 2 })
  })
})
