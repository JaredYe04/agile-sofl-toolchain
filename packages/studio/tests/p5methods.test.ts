/**
 * P5 gate tests for the DETERMINISTIC A/B/C/D method driver (prereg §2, §8; task book §7.5).
 *
 * This is the SMOKE's stand-in for the evaluated methods: it reuses the FROZEN P3/P4
 * RefinementSession and isolates the mechanism ablation (A free-form / B static tree / C
 * adaptive / D proposed + three single-component ablations). The smoke's job (prereg §8) is to
 * run ALL methods on ONE scenario × ONE seed, ALL MOCKS (no LLM), and validate the interaction
 * logs + the scorer — NOT to produce the ablation quality/effort numbers (those are the P6
 * real-LLM measurement under budgets).
 *
 * What the no-budget mock CAN and does demonstrate (asserted here):
 *   - ORACLE ROUTING: every reference item's own topic question routes back to that item
 *     (validates the interaction log — the "no gold leak" path is exercised, values come only
 *     from the oracle's returned text).
 *   - ANTI-FABRICATION: free-form A records no provenance-backed decisions, so its policy values
 *     (stated only in prose) are caught as UNSUPPORTED and A fails the quality floor; every
 *     provenance-backed typed method is supported and meets the floor. This is the exact failure
 *     mode the contribution exists to close (prereg §3.3, §5).
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
import { BOOKING_TASK, P5_TASKS, type ReferenceItem } from '../scripts/agent-harness/p5task'

const SEED = 1
const run = (m: MethodId) => runMethod(m, BOOKING_TASK, { seed: SEED })
const score = (m: MethodId) => scoreRun(BOOKING_TASK, run(m).artifacts)

/** The items the stakeholder does NOT know (unknown / refuse / defer) — the honesty axes. */
const NON_KNOWS = (id: string): ReferenceItem => BOOKING_TASK.referenceItems.find((r) => r.id === id)!

describe('the P5 task set', () => {
  it('exposes the pilot scenario and loads it by id', () => {
    expect(P5_TASKS['booking-01']).toBe(BOOKING_TASK)
    expect(BOOKING_TASK.referenceItems).toHaveLength(8)
    // the scenario deliberately mixes all four stakeholder stances
    const stances = BOOKING_TASK.referenceItems.map((r) => r.policy)
    for (const s of ['knows', 'unknown', 'refuse', 'defer']) expect(stances).toContain(s as never)
  })
})

describe('oracle routing (validates the interaction log — prereg §8)', () => {
  it('each reference items own topic question resolves to that item (first match, not unmatched)', () => {
    const r = run('D')
    for (const item of BOOKING_TASK.referenceItems) {
      const line = r.trace.find((t) => t.itemId === item.id)
      expect(line, `no trace line for ${item.id}`).toBeTruthy()
      expect(line!.matchedItemIds[0]).toBe(item.id)
      expect(line!.unmatched).toBe(false)
      // the stance recorded by the oracle matches the item's frozen policy
      expect(line!.stance).toBe(item.policy)
    }
  })
})

describe('ablation wiring (prereg §2)', () => {
  it('each method reports its frozen profile and records decisions iff the profile records them', () => {
    for (const m of ALL_METHODS) {
      const r = run(m)
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

describe('anti-fabrication: free-form A fails the floor, provenance-backed typed methods meet it (prereg §3.3, §5)', () => {
  it('proposed method D meets the pre-registered quality floor', () => {
    const s = score('D')
    expect(s.meetsQualityFloor).toBe(true)
    expect(s.unsupportedPolicyDecisions).toBe(0)
    expect(s.unsupportedPolicyItemIds).toEqual([])
    expect(s.decisionRecall).toBeCloseTo(1.0)
    expect(s.criticalCoverage).toBeCloseTo(1.0)
    expect(s.precision).toBeCloseTo(1.0)
  })

  it('free-form A: identical recall, but prose-only policy values are UNSUPPORTED -> floor fails', () => {
    const a = score('A')
    // A still recovers the values in its prose (recall is about presence, not provenance)
    expect(a.decisionRecall).toBeCloseTo(1.0)
    // but none of its decisions are actor-backed, so the policy values are unsupported
    expect(a.unsupportedPolicyDecisions).toBeGreaterThanOrEqual(3)
    expect(a.meetsQualityFloor).toBe(false)
    expect(a.floor.unsupportedOk).toBe(false)
  })

  it('every typed method (B/C/D + ablations) is fully supported and meets the floor under full budget', () => {
    for (const m of ALL_METHODS) {
      if (m === 'A') continue
      const s = score(m)
      expect(s.unsupportedPolicyDecisions, `${m} unsupported`).toBe(0)
      expect(s.meetsQualityFloor, `${m} floor`).toBe(true)
    }
  })
})

describe('honesty: non-knows items are left open, never fabricated', () => {
  it('the unknown / refuse / defer items are recorded as terminal stances and left open in the spec', () => {
    const r = run('D')
    const expectStance: Array<[string, 'unknown' | 'refuse' | 'defer']> = [
      ['overbooking', 'unknown'],
      ['loyalty-discount', 'refuse'],
      ['refund-reason', 'defer']
    ]
    for (const [id, stance] of expectStance) {
      const item = NON_KNOWS(id)
      const line = r.trace.find((t) => t.itemId === id)!
      expect(line.stance).toBe(stance)
      // no concrete value was invented for it
      expect(item.policy).not.toBe('knows')
    }
    // the final spec marks these as left open rather than asserting a value
    // (the spec line capitalizes the topic phrase, so compare case-insensitively)
    const spec = r.artifacts.finalSpec.toLowerCase()
    expect(spec).toContain('left open')
    for (const [id] of expectStance) expect(spec, id).toContain(NON_KNOWS(id).topicPhrase.toLowerCase())
  })

  it('the recorded decision answer for a non-knows item is an honest terminal (isTerminal)', () => {
    const r = run('D')
    const over = NON_KNOWS('overbooking')
    const dec = r.artifacts.decisions.find((d) => (d.question ?? '').includes(over.topicPhrase))
    expect(dec).toBeTruthy()
    expect(isTerminal(dec!.answer)).toBe(true)
  })
})

describe('determinism (mock driver + pure scorer)', () => {
  it('an identical seed reproduces byte-identical artifacts and interaction logs', () => {
    for (const m of ['A', 'D', 'D-cost-aware'] as MethodId[]) {
      const r1 = run(m)
      const r2 = run(m)
      expect(JSON.stringify(r1.artifacts)).toBe(JSON.stringify(r2.artifacts))
      expect(JSON.stringify(r1.trace)).toBe(JSON.stringify(r2.trace))
    }
  })
})

describe('effort knob: the cost-aware run respects a stakeholder-effort budget', () => {
  it('a question budget caps the number of questions asked (the P6 effort axis)', () => {
    const full = run('D')
    const capped = runMethod('D', BOOKING_TASK, { seed: SEED, maxQuestions: 5 })
    expect(full.artifacts.questions).toBe(8)
    expect(capped.artifacts.questions).toBeLessThanOrEqual(5)
    // the budget is actually binding (it stopped early rather than asking all 8)
    expect(capped.artifacts.questions).toBeLessThan(full.artifacts.questions)
  })
})
