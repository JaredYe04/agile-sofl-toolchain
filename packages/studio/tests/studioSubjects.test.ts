import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const userData = mkdtempSync(join(tmpdir(), 'studio-subjects-ud-'))
writeFileSync(join(userData, 'llm-profiles.json'), JSON.stringify({ activeId: null, profiles: [] }))
vi.mock('electron', () => ({
  app: { getPath: () => userData, getAppPath: () => userData, isPackaged: false, getVersion: () => '0.0.0-test' },
  ipcMain: { handle: () => undefined, on: () => undefined, removeHandler: () => undefined }
}))

import { applyStudioProposal } from '../src/main/services/agentProposal'
import { helpText, installSubjectDryRunFetch, parseCliArgs } from '../scripts/studio-subjects/cli'
import { runSubject } from '../scripts/studio-subjects/driver'
import { generateAgentModel, loadAgentModel, writeAgentModels } from '../scripts/studio-subjects/models'
import { resolveFromFacts } from '../scripts/studio-subjects/oracle'
import { decideProposal } from '../scripts/studio-subjects/policy'
import { loadSubjects, subjectsAssetsDir } from '../scripts/studio-subjects/subjects'
import { PRODUCTION_MIN_MS, thinkingMsAt, wallSleepMs } from '../scripts/studio-subjects/timing'
import type { InformalPatchPayload } from '../src/main/services/llm/agentTypes'

const assetsDir = subjectsAssetsDir()
const subjects = loadSubjects(assetsDir)

function sse(chunks: unknown[]): Response {
  const body = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n'
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('studio subject models', () => {
  it('checks in one generated model per subject P4–P23', () => {
    expect(subjects.map((subject) => subject.id)).toEqual([
      'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12', 'P13',
      'P14', 'P15', 'P16', 'P17', 'P18', 'P19', 'P20', 'P21', 'P22', 'P23'
    ])
    const written = writeAgentModels(mkdtempSync(join(tmpdir(), 'models-')), subjects)
    for (const model of written) {
      expect(loadAgentModel(assetsDir, model.id)).toEqual(model)
      expect(model.proposalThink.minSeconds).toBeGreaterThanOrEqual(3)
      expect(model.clarificationThink.minSeconds).toBeGreaterThanOrEqual(2)
    }
    const propensities = new Set(written.map((model) => model.acceptPropensity))
    expect(propensities.size).toBeGreaterThan(5)
    const sameBand = written.filter((model) => model.derivedFrom.yearsSpecWork === '5to10' && model.derivedFrom.task === 'greenfield')
    expect(new Set(sameBand.map((model) => model.acceptPropensity)).size).toBeGreaterThan(1)
  })

  it('samples seconds-scale thinking time with variance and a longer draw for a larger patch', () => {
    const model = generateAgentModel(subjects[0]!)
    const small = thinkingMsAt(model.proposalThink, 0, 0.5)
    const large = thinkingMsAt(model.proposalThink, 8000, 0.5)
    expect(small).toBeGreaterThanOrEqual(3000)
    expect(large).toBeGreaterThan(small)
    const draws = [0.2, 0.5, 0.8].map((u) => thinkingMsAt(model.proposalThink, 400, u))
    expect(Math.max(...draws) - Math.min(...draws)).toBeGreaterThan(500)
    expect(wallSleepMs(small, 'production')).toBeGreaterThanOrEqual(PRODUCTION_MIN_MS)
    expect(wallSleepMs(50, 'production')).toBe(PRODUCTION_MIN_MS)
    const dry = wallSleepMs(small, 'dry-run')
    expect(dry).toBeGreaterThanOrEqual(1000)
    expect(dry).toBeLessThanOrEqual(2200)
  })

  it('accepts a small patch on a low draw and rejects a risky patch on a high draw', () => {
    const cautious = generateAgentModel(subjects.find((subject) => subject.yearsSpecWork === 'lt2')!)
    const small: InformalPatchPayload = {
      target: 'informal',
      operations: [{ op: 'add', target: 'functions', node: { type: 'function', title: 'One' } }]
    }
    const risky: InformalPatchPayload = {
      target: 'hybrid',
      mode: 'source',
      operations: Array.from({ length: 8 }, (_, i) => ({ op: i < 3 ? 'remove' : 'replace', id: `n${i}` }))
    }
    const accept = decideProposal(cautious, small, (() => {
      const values = [0.5, 0.01]
      return () => values.shift() ?? 0
    })())
    const reject = decideProposal(cautious, risky, (() => {
      const values = [0.5, 0.95]
      return () => values.shift() ?? 0
    })())
    expect(accept.decision).toBe('accept')
    expect(accept.thinkingMs).toBeGreaterThanOrEqual(3000)
    expect(reject.decision).toBe('reject')
    expect(reject.reasons).toEqual(expect.arrayContaining(['large-patch', 'remove', 'source-edit']))
    expect(reject.acceptProbability).toBeLessThan(accept.acceptProbability)
  })

  it('answers a clarification from an authorized fact and leaves an unknown question unmatched', () => {
    const subject = subjects[0]!
    const resolve = resolveFromFacts(subject.authorizedFacts)
    const hit = resolve({ question: '场景图要包含哪些节点？', options: [] })
    expect(hit.unmatched).toBe(false)
    expect(hit.matchedSlotIds).toContain('scene-graph')
    expect(hit.text).toContain('场景图')
    const miss = resolve({ question: '允许的最大并发连接数是多少？', options: [] })
    expect(miss.unmatched).toBe(true)
    expect(miss.text).toMatch(/Do not invent/)
  })
})

describe('studio proposal apply path', () => {
  it('applies an informal add through the same patch function the IPC handler uses', () => {
    const root = mkdtempSync(join(tmpdir(), 'apply-inf-'))
    const outcome = applyStudioProposal(
      {
        informal: '# Functions\n\n# Data Resources\n\n# Constraints\n',
        hybrid: 'module SYSTEM_RenderCore;\nend_module\n',
        gui: '<div></div>\n'
      },
      {
        target: 'informal',
        explanation: 'add a function',
        operations: [
          {
            op: 'add',
            target: 'functions',
            node: { type: 'function', title: 'Render frame', description: 'Draw one frame.' }
          }
        ]
      },
      root
    )
    expect(outcome.body.action).toBe('applied')
    expect(outcome.applied).toBe(true)
    expect(outcome.texts.informal).toContain('Render frame')
  })

  it('rejects an empty patch instead of writing', () => {
    const outcome = applyStudioProposal(
      { informal: '# Functions\n', hybrid: 'module SYSTEM_X;\nend_module\n', gui: '' },
      { target: 'hybrid', operations: [] },
      mkdtempSync(join(tmpdir(), 'apply-empty-'))
    )
    expect(outcome.body).toMatchObject({ action: 'error', ok: false })
    expect(outcome.applied).toBe(false)
  })

  it('gates a hybrid module add through acceptHybridWrite', () => {
    const outcome = applyStudioProposal(
      {
        informal: '# Functions\n\n# Data Resources\n\n# Constraints\n',
        hybrid: 'module SYSTEM_RenderCore;\nend_module\n',
        gui: '<div></div>\n'
      },
      { target: 'hybrid', operations: [{ op: 'add', kind: 'module', name: 'Scene' }] },
      mkdtempSync(join(tmpdir(), 'apply-hyb-'))
    )
    expect(outcome.body.action).toBe('applied')
    expect(outcome.texts.hybrid).toContain('module Scene')
  })
})

describe('studio subject runner', () => {
  it('prints help and refuses to start without a subject selection', () => {
    expect(helpText()).toMatch(/real Studio agent loop/)
    expect(helpText()).toMatch(/never under 2 seconds|never less than 2 seconds|at least 3 seconds/)
    expect(parseCliArgs(['node', 'studio-subjects', '--help'])).toEqual({ help: true })
    expect(parseCliArgs(['node', 'studio-subjects'])).toMatchObject({ error: expect.stringMatching(/--pilot/) })
    expect(parseCliArgs(['node', 'studio-subjects', '--dry-run', '--subjects', 'P4'])).toMatchObject({
      options: { dryRun: true, mode: 'ids', ids: ['P4'] }
    })
  })

  it('dry-run proposes an informal edit when the original task is an informal phase', async () => {
    installSubjectDryRunFetch()
    const response = await fetch('http://dry-run.local/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'user', content: '这是 新建 Informal 阶段。覆盖初始范围：场景图。' },
          { role: 'tool', content: 'answered' },
          { role: 'user', content: 'Continue now. Prefer propose_changes / propose_hybrid_changes.' }
        ]
      })
    })
    const text = await response.text()
    expect(text).toContain('propose_changes')
    expect(text).toContain('Dry run function')
  })

  it('runs P4 on the Studio loop with a non-instant decision', async () => {
    process.env.ECNU_API_KEY = 'sk-testtesttesttest'
    const slept: number[] = []
    const replies = makeDryRunReplies()
    vi.stubGlobal('fetch', vi.fn(async () => replies.shift() ?? stopReply()))
    const out = mkdtempSync(join(tmpdir(), 'subject-p4-'))
    const result = await runSubject({
      subject: subjects.find((subject) => subject.id === 'P4')!,
      model: loadAgentModel(assetsDir, 'P4'),
      assetsDir,
      outDir: out,
      pace: 'production',
      maxDecisions: 2,
      sleep: async (ms) => {
        slept.push(ms)
      }
    })
    expect(result.decisions).toBeGreaterThan(0)
    expect(result.minSleptMs).toBeGreaterThanOrEqual(PRODUCTION_MIN_MS)
    expect(slept.every((ms) => ms >= PRODUCTION_MIN_MS)).toBe(true)
    const events = readFileSync(join(out, 'events.jsonl'), 'utf-8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { type: string; intendedThinkingMs?: number; sleptMs?: number; policy?: string })
    const proposals = events.filter((event) => event.type === 'proposal_decision')
    expect(proposals.length).toBeGreaterThan(0)
    for (const event of proposals) {
      expect(event.intendedThinkingMs).toBeGreaterThanOrEqual(3000)
      expect(event.sleptMs).toBeGreaterThanOrEqual(PRODUCTION_MIN_MS)
    }
    const clarifications = events.filter((event) => event.type === 'clarification_answer')
    expect(clarifications.length).toBeGreaterThan(0)
    for (const event of clarifications) expect(event.intendedThinkingMs).toBeGreaterThanOrEqual(2000)
    const calls = readdirSync(join(out, 'project', '.agile-sofl')).some((name) => name === 'llm-calls.jsonl')
    expect(calls).toBe(true)
    const telemetry = readFileSync(join(out, 'project', '.agile-sofl', 'llm-calls.jsonl'), 'utf-8')
    expect(telemetry).toContain('"event":"proposal_decision"')
    expect(readdirSync(join(out, 'project', '.agile-sofl', 'agent', 'sessions')).length).toBeGreaterThan(0)
    expect(readFileSync(join(out, 'project', 'informal.aspec'), 'utf-8').length).toBeGreaterThan(0)
  }, 60_000)
})

function stopReply(): Response {
  return sse([
    { model: 'dry-run', choices: [{ delta: { content: 'dry-run done' }, finish_reason: 'stop' }] },
    { model: 'dry-run', choices: [], usage: { prompt_tokens: 1, completion_tokens: 1 } }
  ])
}

function toolReply(name: string, args: unknown): Response {
  const call = { index: 0, id: `c-${name}-${Math.random()}`, function: { name, arguments: JSON.stringify(args) } }
  return sse([
    { model: 'dry-run', choices: [{ delta: { tool_calls: [call] } }] },
    { model: 'dry-run', choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
    { model: 'dry-run', choices: [], usage: { prompt_tokens: 4, completion_tokens: 2 } }
  ])
}

/** Enough scripted turns for three phases: clarify, propose, stop, repeated. */
function makeDryRunReplies(): Response[] {
  const replies: Response[] = []
  for (let phase = 0; phase < 3; phase++) {
    replies.push(
      toolReply('ask_clarification', {
        question: '场景图和主循环是否按任务包？',
        options: [{ id: 'confirm', label: '按任务包事实' }]
      })
    )
    replies.push(
      phase === 0
        ? toolReply('propose_changes', {
            explanation: 'dry-run informal',
            operations: [
              {
                op: 'add',
                target: 'functions',
                node: { type: 'function', title: 'Dry run function', description: 'Frame.' }
              }
            ]
          })
        : toolReply('propose_hybrid_changes', {
            explanation: 'dry-run hybrid',
            operations: [{ op: 'add', kind: 'module', name: `Child${phase}` }]
          })
    )
    replies.push(stopReply())
  }
  return replies
}
