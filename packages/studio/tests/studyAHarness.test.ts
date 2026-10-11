import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const userData = mkdtempSync(join(tmpdir(), 'study-a-ud-'))
writeFileSync(join(userData, 'llm-profiles.json'), JSON.stringify({ activeId: null, profiles: [] }))
vi.mock('electron', () => ({ app: { getPath: () => userData, getAppPath: () => userData }, ipcMain: { handle: () => undefined } }))

import { PILOT_TEMPERATURE, runOnce } from '../scripts/agent-harness/core'
import { runStudyA, scoreStudyAKey } from '../scripts/agent-harness/study-a'
import { createStakeholderOracle } from '../scripts/agent-harness/studyAOracle'
import { loadGold } from '../scripts/agent-harness/studyAGold'
import { buildStudyAConfig } from '../scripts/agent-harness/studyAConfig'

const here = dirname(fileURLToPath(import.meta.url))
const libraryPath = join(here, '../../../research-reframing/study-a/dev/scenarios/dev-library-renewal.json')
const repo = join(here, '../../..')
const originalFetch = globalThis.fetch

function sse(chunks: unknown[]): Response {
  const body = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n'
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
  globalThis.fetch = originalFetch
  delete process.env.AGILE_SOFL_DASR
})

describe('Study A on the existing agent loop', () => {
  it('records temperature 0.35 from the pilot constant', () => {
    expect(buildStudyAConfig({ gitCommit: 'a', pilotFreezeCommit: null, configuredModelId: 'ecnu-max', harnessSha256: 'b' }).temperature).toBe(PILOT_TEMPERATURE)
  })

  it('answers a clarification from the gold file and restores the DASR flag', async () => {
    process.env.ECNU_API_KEY = 'sk-testtesttesttest'
    process.env.AGILE_SOFL_DASR = 'sentinel'
    const gold = loadGold(libraryPath)
    const events: Array<Record<string, unknown>> = []
    vi.stubGlobal('fetch', vi.fn(async () => sse([
      { model: 'mock-model', choices: [{ delta: { tool_calls: [{ index: 0, id: 'c-ask', function: { name: 'ask_clarification', arguments: JSON.stringify({ question: 'How many times may a patron renew a loan?' }) } }] } }] },
      { model: 'mock-model', choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
      { model: 'mock-model', choices: [], usage: { prompt_tokens: 4, completion_tokens: 1 } }
    ])))
    const out = mkdtempSync(join(tmpdir(), 'study-a-once-'))
    const informal = join(out, 'library.aspec')
    writeFileSync(informal, gold.informalMarkdown)
    const result = await runOnce({
      condition: 'T',
      dasrMode: 'C1',
      informalPath: informal,
      outDir: out,
      maxApprovals: 1,
      resolveClarification: createStakeholderOracle(gold),
      onStudyEvent: (event) => { events.push(event) }
    })
    expect(process.env.AGILE_SOFL_DASR).toBe('sentinel')
    const experiment = JSON.parse(readFileSync(join(result.runDir, '.agile-sofl', 'experiment.json'), 'utf-8'))
    expect(experiment.dasrMode).toBe('C1')
    expect(experiment.dasr).toBe(false)
    expect(experiment.condition).toBe('T')
    const asked = events.find((event) => event.type === 'clarification_asked')
    const reply = events.find((event) => event.type === 'oracle_reply')
    expect(asked?.question).toMatch(/renew/)
    expect(reply).toMatchObject({ matchedSlotIds: ['renewal-cap'], unmatched: false })
    expect(JSON.stringify(events)).not.toMatch(/dasrMode|studyCondition|"C1"|"C2"/)
    const manifest = JSON.parse(readFileSync(join(result.runDir, 'manifest.json'), 'utf-8'))
    expect(manifest.temperature).toBe(0.35)
  }, 60000)

  it('runs C1 and C2 on one DEV scenario and writes scenario-level SCR logs', async () => {
    process.env.ECNU_API_KEY = 'sk-testtesttesttest'
    const out = mkdtempSync(join(tmpdir(), 'study-a-batch-'))
    const keyFile = join(tmpdir(), `study-a-${Date.now()}.key.json`)
    const { key } = await runStudyA({
      repo,
      scenarioPaths: [libraryPath],
      conditions: ['C1', 'C2'],
      repeats: 1,
      maxApprovals: 4,
      out,
      keyFile,
      dryRun: true,
      seed: 7,
      goldSchemaPath: join(repo, 'research-reframing/study-a/schema/gold-package.schema.json')
    })
    expect(key.confirmatoryFreezeTag).toBeNull()
    expect(key.confirmatory).toBe(false)
    expect(key.runs).toHaveLength(2)
    expect(key.runs.map((run) => run.condition).sort()).toEqual(['C1', 'C2'])
    expect(key.runs.every((run) => run.status === 'ok')).toBe(true)
    expect(key.runs[0]?.promptHash).toBe(key.runs[1]?.promptHash)
    const modes = key.runs.map((run) => JSON.parse(readFileSync(join(out, 'runs', run.runId, '.agile-sofl', 'experiment.json'), 'utf-8')).dasrMode)
    expect(modes.sort()).toEqual(['C1', 'C2'])
    const c1 = key.runs.find((run) => run.condition === 'C1')!
    const c2 = key.runs.find((run) => run.condition === 'C2')!
    const c1Events = readFileSync(join(out, 'runs', c1.runId, 'study-events.jsonl'), 'utf-8')
    const c2Events = readFileSync(join(out, 'runs', c2.runId, 'study-events.jsonl'), 'utf-8')
    expect(c1Events).not.toMatch(/dasrMode|studyCondition/)
    expect(c2Events).not.toMatch(/dasrMode|studyCondition/)
    expect(c1Events).toContain('"type":"proposal"')
    expect(c2Events).toContain('"type":"decision_gate"')
    expect(c2Events).toContain('"allow":false')
    expect(readFileSync(join(out, 'blinded', c1.runId, 'final.asfl'), 'utf-8').length).toBeGreaterThan(0)
    const score = scoreStudyAKey(key)
    expect(score.samplingUnit).toBe('scenario')
    expect(score.primaryOutcome).toBe('SCR for C2 versus C1')
    expect(score.paired).toHaveLength(1)
    expect(score.paired[0]?.scenarioId).toBe('dev-library-renewal')
    expect(score.scenarios).toHaveLength(2)
    expect(score.scenarios.every((row) => row.replications === 1)).toBe(true)
    const config = JSON.parse(readFileSync(join(out, 'study-config.json'), 'utf-8'))
    expect(config.confirmatoryFreezeTag).toBeNull()
    expect(config.temperature).toBe(0.35)
    expect(config.configuredModelId).toBeTruthy()
    expect(config.hashes.skillPromptSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(config.hashes.c2ToolSchemaSha256).not.toBe(config.hashes.c1ToolSchemaSha256)
    expect(config.gitCommit).toMatch(/^[a-f0-9]{40}$/)
    expect(config.c0.status).toBe('deferred-secondary')
  }, 120000)
})
