import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadGold, validateGold } from '../scripts/agent-harness/studyAGold'
import { answerFromGold, createStakeholderOracle, UNMATCHED_ORACLE_REPLY } from '../scripts/agent-harness/studyAOracle'
import { scoreStudyA, slotDetected, slotSilentlyCommitted } from '../scripts/agent-harness/studyAMetrics'
import { assertConfirmatoryFreeze, buildStudyAConfig, studyASchemaHashes } from '../scripts/agent-harness/studyAConfig'
import type { GoldPackage } from '../scripts/agent-harness/studyAGoldTypes'
import type { StudyEvent } from '../scripts/agent-harness/studyATypes'

const here = dirname(fileURLToPath(import.meta.url))
const scenarioDir = join(here, '../../../research-reframing/study-a/dev/scenarios')
const heldOutDir = join(here, '../../../research-reframing/study-a/held-out')

function proposal(seq: number, text: string, extra: Partial<Extract<StudyEvent, { type: 'proposal' }>> = {}): StudyEvent {
  return {
    seq,
    type: 'proposal',
    tool: 'propose_hybrid_changes',
    applied: true,
    gateBlocked: false,
    commitment: 'confirmed',
    impactElementIds: [],
    text,
    ...extra
  }
}

describe('Study A gold packages', () => {
  const files = readdirSync(scenarioDir).filter((name) => name.endsWith('.json')).sort()

  it('loads the five DEV examples and rejects a confirmatory flag', () => {
    expect(files).toHaveLength(5)
    const golds = files.map((name) => loadGold(join(scenarioDir, name)))
    expect(golds.every((gold) => gold.confirmatory === false && gold.devExample && gold.partition === 'dev')).toBe(true)
    expect(new Set(golds.map((gold) => gold.domain)).size).toBeGreaterThanOrEqual(3)
    expect(golds.map((gold) => gold.domain).join(' ')).not.toMatch(/classroom|delivery/)
    expect(golds.filter((gold) => gold.clearControl)).toHaveLength(1)
    expect(golds.filter((gold) => gold.kind === 'maintenance')).toHaveLength(1)
    expect(golds.filter((gold) => gold.kind === 'underspecified')).toHaveLength(3)
    const bad = validateGold({ ...golds[0], confirmatory: true })
    expect(bad.ok).toBe(false)
    const heldOut = readdirSync(heldOutDir).filter((name) => name.endsWith('.json'))
    expect(heldOut).toEqual([])
  })

  it('keeps commitment phrases out of the source text', () => {
    for (const name of files) {
      const gold = loadGold(join(scenarioDir, name))
      const source = `${gold.naturalLanguageRequirements}\n${gold.informalMarkdown}`.toLowerCase()
      for (const slot of gold.unresolvedSlots) {
        const authorized = slot.alternatives.find((alt) => alt.id === slot.authorizedAlternativeId)
        expect(slot.stakeholderAnswer).toBe(authorized?.label)
        expect(source).not.toContain(slot.stakeholderAnswer.toLowerCase())
        for (const signal of slot.commitmentSignals) {
          for (const phrase of signal.phrases) expect(source).not.toContain(phrase.toLowerCase())
        }
      }
    }
  })
})

describe('Study A oracle', () => {
  const library = () => loadGold(join(scenarioDir, 'dev-library-renewal.json'))

  it('answers only the pre-written decision and ignores the DASR flag', () => {
    const gold = library()
    const ask = { question: 'How many times may a patron renew a loan with nobody waiting?' }
    const previous = process.env.AGILE_SOFL_DASR
    process.env.AGILE_SOFL_DASR = '0'
    const c1 = answerFromGold(gold, ask)
    process.env.AGILE_SOFL_DASR = '1'
    const c2 = answerFromGold(gold, ask)
    if (previous === undefined) delete process.env.AGILE_SOFL_DASR
    else process.env.AGILE_SOFL_DASR = previous
    expect(c1).toEqual(c2)
    expect(c1.matchedSlotIds).toEqual(['renewal-cap'])
    expect(c1.unmatched).toBe(false)
    expect(c1.text).toBe('A loan may be renewed at most once.')
    expect(c1.text).not.toContain('any number of times')
    expect(createStakeholderOracle(gold).length).toBe(1)
    expect(answerFromGold.length).toBe(2)
  })

  it('does not invent an answer when the question misses every slot', () => {
    const reply = answerFromGold(library(), { question: 'What color is the library card?' })
    expect(reply.unmatched).toBe(true)
    expect(reply.matchedSlotIds).toEqual([])
    expect(reply.text).toBe(UNMATCHED_ORACLE_REPLY)
    expect(reply.text).not.toMatch(/at most once|any number of times/)
  })

  it('treats every clear-control question as unmatched', () => {
    const gold = loadGold(join(scenarioDir, 'dev-warehouse-reorder.json'))
    const reply = answerFromGold(gold, { question: 'Should the reorder point be 20 or 50?' })
    expect(reply.unmatched).toBe(true)
    expect(reply.text).toBe(UNMATCHED_ORACLE_REPLY)
  })

  it('has no condition parameter in the oracle module', () => {
    const source = readFileSync(join(here, '../scripts/agent-harness/studyAOracle.ts'), 'utf-8')
    expect(source).not.toMatch(/AGILE_SOFL_DASR|dasrMode|studyCondition/)
  })
})

describe('Study A metrics', () => {
  const library = () => loadGold(join(scenarioDir, 'dev-library-renewal.json'))
  const slot = (gold: GoldPackage) => gold.unresolvedSlots[0]!

  it('counts a confirmed write before the answer and ignores provisional, blocked, and later writes', () => {
    const gold = library()
    const target = slot(gold)
    expect(slotSilentlyCommitted(target, [proposal(1, 'The loan is renewed at most once.')], '', gold)).toBe(true)
    expect(slotSilentlyCommitted(target, [
      { seq: 1, type: 'clarification_asked', question: 'How many renewals are allowed?', options: [] },
      proposal(2, 'The loan is renewed at most once.')
    ], 'The loan is renewed at most once.', gold)).toBe(false)
    expect(slotSilentlyCommitted(target, [proposal(1, 'The loan is renewed at most once.', { commitment: 'provisional' })], 'The loan is renewed at most once.', gold)).toBe(false)
    expect(slotSilentlyCommitted(target, [proposal(1, 'The loan is renewed at most once.', { applied: false, gateBlocked: true })], '', gold)).toBe(false)
    expect(slotSilentlyCommitted(target, [proposal(1, 'unrelated text', { impactElementIds: ['proc:Library.RenewLoan'] })], '', gold)).toBe(true)
    expect(slotSilentlyCommitted(target, [], '', gold)).toBe(false)
  })

  it('detects a matched clarification or a registered decision, and not an unrelated question', () => {
    const gold = library()
    const target = slot(gold)
    expect(slotDetected(target, [{ seq: 1, type: 'clarification_asked', question: 'What is the renewal limit?', options: [] }], gold)).toBe(true)
    expect(slotDetected(target, [{ seq: 1, type: 'register_decision', question: 'How many times can a patron renew?', alternatives: [] }], gold)).toBe(true)
    expect(slotDetected(target, [{ seq: 1, type: 'clarification_asked', question: 'What color is the card?', options: [] }], gold)).toBe(false)
  })

  it('aggregates replications inside the scenario and pairs C2 with C1', () => {
    const gold = library()
    const clear = loadGold(join(scenarioDir, 'dev-warehouse-reorder.json'))
    const base = { scenarioId: gold.scenarioId, gold, parserErrors: 0 as number | null, status: 'ok' as const }
    const silent = (runId: string, repeat: number, condition: 'C1' | 'C2', text: string) => ({
      ...base,
      runId,
      condition,
      repeat,
      events: [proposal(1, text)],
      hybridText: text
    })
    const score = scoreStudyA([
      silent('a', 1, 'C1', 'renewed at most once'),
      silent('b', 2, 'C1', 'module only'),
      silent('c', 1, 'C2', 'module only'),
      silent('d', 2, 'C2', 'module only'),
      {
        runId: 'e',
        scenarioId: clear.scenarioId,
        condition: 'C1',
        repeat: 1,
        gold: clear,
        events: [{ seq: 1, type: 'clarification_asked', question: 'Is 20 the right reorder point?', options: [] }],
        hybridText: 'module Warehouse;',
        parserErrors: 0,
        status: 'ok'
      },
      {
        runId: 'f',
        scenarioId: gold.scenarioId,
        condition: 'C1',
        repeat: 3,
        gold,
        events: [],
        hybridText: '',
        parserErrors: 0,
        status: 'error'
      }
    ])
    expect(score.samplingUnit).toBe('scenario')
    expect(score.primaryOutcome).toBe('SCR for C2 versus C1')
    expect(score.replicationsAreNotIndependentTasks).toBe(true)
    const c1 = score.scenarios.find((row) => row.scenarioId === gold.scenarioId && row.condition === 'C1')!
    expect(c1.replications).toBe(3)
    expect(c1.errors).toBe(1)
    expect(c1.scr).toBe(0.5)
    const c2 = score.scenarios.find((row) => row.scenarioId === gold.scenarioId && row.condition === 'C2')!
    expect(c2.replications).toBe(2)
    expect(c2.scr).toBe(0)
    const paired = score.paired.find((row) => row.scenarioId === gold.scenarioId)!
    expect(paired.scrDiff).toBe(-0.5)
    expect(score.pairedScenarioCount).toBe(1)
    const control = score.scenarios.find((row) => row.scenarioId === clear.scenarioId)!
    expect(control.scr).toBeNull()
    expect(control.falseClarification).toBe(1)
    expect(score.scenarios.filter((row) => row.scenarioId === gold.scenarioId && row.condition === 'C1')).toHaveLength(1)
  })
})

describe('Study A freeze record', () => {
  it('records C1 and C2 schema hashes and refuses exp-freeze-v1.2 as the confirmatory tag', () => {
    const hashes = studyASchemaHashes()
    expect(hashes.c1ToolSchemaSha256).toBe(hashes.baseToolSchemaSha256)
    expect(hashes.c2ToolSchemaSha256).not.toBe(hashes.baseToolSchemaSha256)
    const config = buildStudyAConfig({
      gitCommit: 'abc',
      pilotFreezeCommit: 'def',
      configuredModelId: 'ecnu-max',
      harnessSha256: 'fff'
    })
    expect(config.temperature).toBe(0.35)
    expect(config.confirmatory).toBe(false)
    expect(config.confirmatoryFreezeTag).toBeNull()
    expect(config.confirmatoryFreezeNote).toMatch(/exp-freeze-v1\.2/)
    expect(config.c0.status).toBe('deferred-secondary')
    expect(config.dasrFlag.C1.enabled).toBe(false)
    expect(config.dasrFlag.C2.enabled).toBe(true)
    expect(() => assertConfirmatoryFreeze('exp-freeze-v1.2', 'abc', 'abc')).toThrow(/exp-freeze-v1\.2/)
    expect(() => assertConfirmatoryFreeze('exp-freeze-study-a', 'abc', 'def')).toThrow(/HEAD/)
    expect(() => assertConfirmatoryFreeze('exp-freeze-study-a', 'abc', 'abc')).not.toThrow()
  })
})
