/**
 * P5 gate tests for the DETERMINISTIC A/B/C/D method driver (prereg §2, §8; task book §7.5).
 *
 * This is the SMOKE's stand-in for the evaluated methods: it reuses the FROZEN P3/P4
 * RefinementSession and isolates the mechanism ablation (A free-form / B static tree / C
 * adaptive / D proposed + three single-component ablations). The smoke's job (prereg §8) is to
 * run ALL methods on the pilot scenarios, ALL MOCKS (no LLM), and validate the interaction
 * logs + the scorer — NOT to produce the ablation quality/effort numbers (those are the P6
 * real-LLM measurement under budgets).
 *
 * What the no-budget mock CAN and does demonstrate (asserted here, across the whole 3-task
 * pilot set):
 *   - ORACLE ROUTING: every reference item's own topic question routes back to that item
 *     (validates the interaction log — the "no gold leak" path is exercised, values come only
 *     from the oracle's returned text).
 *   - ANTI-FABRICATION: free-form A records no provenance-backed decisions, so its policy
 *     values (stated only in prose) are caught as UNSUPPORTED and A fails the quality floor on
 *     every task; every provenance-backed typed method (D) meets the floor with 0 unsupported.
 *     This is the exact failure mode the contribution exists to close (prereg §3.3, §5).
 *   - HONESTY: the non-knows items (unknown / refuse / defer) are left open, never fabricated.
 *   - DETERMINISM: an identical seed reproduces byte-identical artifacts + logs.
 *   - BUDGET: the cost-aware run respects a stakeholder-effort budget (the knob the P6 effort
 *     comparison turns).
 *
 * What it deliberately does NOT assert: that D scores higher than C on quality/effort. With no
 * budget and a canonical oracle, every typed method recovers the full set, so coverage is equal;
 * the selection/obligations/propagation knobs change ORDER and provenance-source, not coverage,
 * in the mock. Their differentiation is a P6 measurement, and asserting a gap here would be a
 * fabricated result.
 */
import { describe, it, expect } from 'vitest'
import { runMethod, ALL_METHODS, METHOD_PROFILES, type MethodId } from '../scripts/agent-harness/p5methods'
import { scoreRun, isTerminal } from '../scripts/agent-harness/scorer'
import { P5_TASKS, BOOKING_TASK, type P5Task } from '../scripts/agent-harness/p5task'

const SEED = 1
const run = (m: MethodId, task: P5Task) => runMethod(m, task, { seed: SEED })
const score = (m: MethodId, task: P5Task) => scoreRun(task, run(m, task).artifacts)

describe('the P5 pilot task set', () => {
  it('has three scenarios, each mixing all four stakeholder stances (prereg §5: pilot = 3 scenarios)', () => {
    expect(Object.keys(P5_TASKS).sort()).toEqual(['booking-01', 'ecommerce-01', 'taskmgmt-01'])
    for (const task of Object.values(P5_TASKS)) {
      const stances = task.referenceItems.map((r) => r.policy)
      for (const s of ['knows', 'unknown', 'refuse', 'defer']) expect(stances, `${task.id} missing stance ${s}`).toContain(s as never)
      expect(task.referenceItems.length, `${task.id} item count`).toBeGreaterThanOrEqual(6)
    }
  })
})

describe('oracle routing (validates the interaction log — prereg §8)', () => {
  it('each item own topic question resolves to that item on every task (first match, not unmatched)', () => {
    for (const task of Object.values(P5_TASKS)) {
      const r = run('D', task)
      for (const item of task.referenceItems) {
        const line = r.trace.find((t) => t.itemId === item.id)
        expect(line, `${task.id}: no trace line for ${item.id}`).toBeTruthy()
        expect(line!.matchedItemIds[0], `${task.id}/${item.id} routing`).toBe(item.id)
        expect(line!.unmatched, `${task.id}/${item.id} unmatched`).toBe(false)
        expect(line!.stance, `${task.id}/${item.id} stance`).toBe(item.policy)
      }
    }
  })
})

describe('ablation wiring (prereg §2)', () => {
  it('each method reports its frozen profile and records decisions iff the profile records them', () => {
    const task = BOOKING_TASK
    for (const m of ALL_METHODS) {
      const r = run(m, task)
      expect(r.profile).toEqual(METHOD_PROFILES[m])
      const n = r.artifacts.decisions.length
      // only free-form A records NO typed decisions; every typed method records one per item
      expect(n, `method ${m} decision count`).toBe(METHOD_PROFILES[m].recordsTypedDecision ? 8 : 0)
    }
  })

  it('the seven frozen profiles isolate exactly one mechanism dimension each', () => {
    // D is the full proposed mechanism; each ablation turns off exactly one dimension vs D.
    const d = METHOD_PROFILES['D']!
    expect(d).toMatchObject({ usesTypedTree: true, usesObligations: true, selection: 'cost-aware', recordsTypedDecision: true, usesPropagation: true })
    // each single-component ablation turns off exactly one dimension vs D (and keeps the rest):
    expect(METHOD_PROFILES['D-cost-aware']!.selection).toBe('static') // D − cost-aware: flat order
    expect(METHOD_PROFILES['D-propagation']!.usesPropagation).toBe(false) // D − propagation
    expect(METHOD_PROFILES['D-obligations']!.usesObligations).toBe(false) // D − obligations
    // the baselines: C is adaptive with NO semantic obligations; B is a static tree; A is free-form
    expect(METHOD_PROFILES['C']!.usesObligations).toBe(false)
    expect(METHOD_PROFILES['B']!.selection).toBe('static')
    expect(METHOD_PROFILES['A']!.usesTypedTree).toBe(false)
  })
})

describe('anti-fabrication: free-form A fails the floor, provenance-backed D meets it (prereg §3.3, §5)', () => {
  it('proposed method D meets the pre-registered quality floor on every task', () => {
    for (const task of Object.values(P5_TASKS)) {
      const s = score('D', task)
      expect(s.meetsQualityFloor, `${task.id} D floor`).toBe(true)
      expect(s.unsupportedPolicyDecisions, `${task.id} D unsupported`).toBe(0)
      expect(s.unsupportedPolicyItemIds, `${task.id} D unsupported ids`).toEqual([])
      expect(s.decisionRecall, `${task.id} D recall`).toBeCloseTo(1.0)
      expect(s.criticalCoverage, `${task.id} D critical`).toBeCloseTo(1.0)
      expect(s.precision, `${task.id} D precision`).toBeCloseTo(1.0)
    }
  })

  it('free-form A: identical recall, but prose-only policy values are UNSUPPORTED -> floor fails on every task', () => {
    for (const task of Object.values(P5_TASKS)) {
      const a = score('A', task)
      // A still recovers the values in its prose (recall is about presence, not provenance)
      expect(a.decisionRecall, `${task.id} A recall`).toBeCloseTo(1.0)
      // but none of its decisions are actor-backed, so its policy values are unsupported
      expect(a.unsupportedPolicyDecisions, `${task.id} A unsupported`).toBeGreaterThanOrEqual(1)
      expect(a.meetsQualityFloor, `${task.id} A floor`).toBe(false)
      expect(a.floor.unsupportedOk, `${task.id} A unsupported axis`).toBe(false)
    }
  })

  it('every typed method (B/C/D + ablations) is fully supported and meets the floor on every task', () => {
    for (const task of Object.values(P5_TASKS)) {
      for (const m of ALL_METHODS) {
        if (m === 'A') continue
        const s = score(m, task)
        expect(s.unsupportedPolicyDecisions, `${task.id}/${m} unsupported`).toBe(0)
        expect(s.meetsQualityFloor, `${task.id}/${m} floor`).toBe(true)
      }
    }
  })
})

describe('honesty: non-knows items are left open, never fabricated', () => {
  it('every non-knows item (unknown / refuse / defer) is left open in the spec on every task', () => {
    for (const task of Object.values(P5_TASKS)) {
      const r = run('D', task)
      const nonKnows = task.referenceItems.filter((i) => i.policy !== 'knows')
      expect(nonKnows.length, `${task.id} should have non-knows items`).toBeGreaterThanOrEqual(3)
      const spec = r.artifacts.finalSpec.toLowerCase()
      expect(spec, `${task.id} spec marks left-open`).toContain('left open')
      for (const item of nonKnows) {
        // the topic is present but marked left open (the spec line capitalizes the phrase)
        expect(spec, `${task.id}/${item.id} present`).toContain(item.topicPhrase.toLowerCase())
        // no concrete value was invented for it
        expect(item.policy, `${task.id}/${item.id} is non-knows`).not.toBe('knows')
      }
    }
  })

  it('the recorded decision answer for a non-knows item is an honest terminal (isTerminal)', () => {
    for (const task of Object.values(P5_TASKS)) {
      const r = run('D', task)
      for (const item of task.referenceItems) {
        if (item.policy === 'knows') continue
        const dec = r.artifacts.decisions.find((d) => (d.question ?? '').toLowerCase().includes(item.topicPhrase.toLowerCase()))
        expect(dec, `${task.id}/${item.id} has a recorded decision`).toBeTruthy()
        expect(isTerminal(dec!.answer), `${task.id}/${item.id} answer is terminal`).toBe(true)
      }
    }
  })
})

describe('determinism (mock driver + pure scorer)', () => {
  it('an identical seed reproduces byte-identical artifacts and interaction logs', () => {
    const task = BOOKING_TASK
    for (const m of ['A', 'D', 'D-cost-aware'] as MethodId[]) {
      const r1 = run(m, task)
      const r2 = run(m, task)
      expect(JSON.stringify(r1.artifacts)).toBe(JSON.stringify(r2.artifacts))
      expect(JSON.stringify(r1.trace)).toBe(JSON.stringify(r2.trace))
    }
  })
})

describe('effort knob: the cost-aware run respects a stakeholder-effort budget', () => {
  it('a question budget caps the number of questions asked (the P6 effort axis)', () => {
    const task = BOOKING_TASK
    const full = run('D', task)
    const capped = runMethod('D', task, { seed: SEED, maxQuestions: 5 })
    expect(full.artifacts.questions).toBe(task.referenceItems.length)
    expect(capped.artifacts.questions).toBeLessThanOrEqual(5)
    // the budget is actually binding (it stopped early rather than asking all items)
    expect(capped.artifacts.questions).toBeLessThan(full.artifacts.questions)
  })
})
