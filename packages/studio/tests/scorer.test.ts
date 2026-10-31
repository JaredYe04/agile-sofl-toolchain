/**
 * P5 gate tests for the deterministic RUN SCORER (task book §7.5 / prereg §3, §4).
 *
 * The gate requires the scorer to run INDEPENDENTLY and to be validated against INTENTIONALLY
 * correct / wrong / missing data. These tests do exactly that, against BOOKING_TASK's gold:
 * a perfect (decision-backed) run meets the quality floor; a fabricated value for an UNDECIDED
 * item is caught as an unsupported policy decision; a missed must-have / critical drops recall /
 * critical-coverage; an unprovenanced free-text value is caught as unsupported; and terminal
 * markers (unknown/defer/none_of_above/待定) are never treated as invented values. The scorer is
 * pure, so two scores of the same input are byte-identical.
 */
import { describe, it, expect } from 'vitest'
import { scoreRun, isTerminal, valuePresent, SUPPORTED_PROVENANCE, QUALITY_FLOOR, type RecordedDecisionRef, type RunArtifacts } from '../scripts/agent-harness/scorer'
import { BOOKING_TASK } from '../scripts/agent-harness/p5task'

const DEC = (question: string, answer: string, provenance: string = 'simulated_user_answer'): RecordedDecisionRef =>
  ({ question, answer, provenance, status: 'recorded' })

/** A final spec that states every decision the stakeholder actually knows (the 5 'knows' values). */
const PERFECT_SPEC =
  'A refund is available within 48 hours of the booking. ' +
  'A user may hold at most 3 active bookings at the same time. ' +
  'An unpaid seat is held for 15 minutes, then released. ' +
  'The same seat cannot be booked by two users for the same time slot. ' +
  'Cancellation is allowed only before the event start time.'

/** Decision-backed, in reference order (so each item materializes from its own decision). */
const PERFECT_DECISIONS: RecordedDecisionRef[] = [
  DEC('What is the refund window?', 'within 48 hours of the booking'),
  DEC('What is the maximum number of active bookings a user can have?', 'at most 3 active bookings at the same time'),
  DEC('What happens to an unpaid reserved seat?', 'held for 15 minutes, then released'),
  DEC('Can the same seat be double-booked by two users?', 'a seat cannot be booked by two users for the same time slot'),
  DEC('What is the cancellation cutoff?', 'cancellation is allowed only before the event start time'),
  DEC('Do you allow overbooking?', 'unknown'),
  DEC('Do you offer loyalty discounts?', 'none_of_above'),
  DEC('What refund reason codes do you use?', 'defer')
]

const baseRun = (over: Partial<RunArtifacts>): RunArtifacts => ({
  method: 'D', taskId: 'booking-01', seed: 1, finalSpec: PERFECT_SPEC,
  decisions: PERFECT_DECISIONS, questions: 8, redundantQuestions: 0, stakeholderWords: 140,
  ...over
})

describe('terminal / value detection (anti-fabrication primitives)', () => {
  it('treats unknown / defer / none_of_above (EN + 中文) as honest non-values', () => {
    for (const t of ['unknown', 'none_of_above', 'none of the above', 'defer', 'deferred', 'TBD', 'to be decided', '待定', '尚未决定', '下个季度再定'])
      expect(isTerminal(t), t).toBe(true)
    for (const t of ['within 48 hours of the booking', 'at most 3 active bookings', 'held for 15 minutes'])
      expect(isTerminal(t), t).toBe(false)
  })

  it('valuePresent: exact value or (numeric) all-numbers + a keyword; wrong number fails', () => {
    const refund = BOOKING_TASK.referenceItems.find((r) => r.id === 'refund-window')!
    const max = BOOKING_TASK.referenceItems.find((r) => r.id === 'max-active-bookings')!
    expect(valuePresent(refund, 'refunds are available within 48 hours of the booking')).toBe(true)
    expect(valuePresent(refund, 'refunds are available within 24 hours of the booking')).toBe(false)
    expect(valuePresent(max, 'a customer may hold at most 3 active bookings at the same time')).toBe(true)
    expect(valuePresent(max, 'a customer may hold at most 5 active bookings at the same time')).toBe(false)
    expect(valuePresent(max, 'there is no booking limit for any customer')).toBe(false)
  })
})

describe('a correct (decision-backed) run meets the pre-registered quality floor', () => {
  it('recall / critical-coverage / precision = 1.0, unsupported = 0, floor met', () => {
    const s = scoreRun(BOOKING_TASK, baseRun({}))
    expect(s.decisionRecall).toBeCloseTo(1.0)
    expect(s.criticalCoverage).toBeCloseTo(1.0)
    expect(s.precision).toBeCloseTo(1.0)
    expect(s.unsupportedPolicyDecisions).toBe(0)
    expect(s.unsupportedPolicyItemIds).toEqual([])
    expect(s.meetsQualityFloor).toBe(true)
    expect(s.floor).toMatchObject({ recallOk: true, unsupportedOk: true, criticalOk: true })
  })
})

describe('INTENTIONAL WRONG data: a fabricated value for an UNDECIDED item is caught', () => {
  it('fabricating overbooking (unknown) -> unsupported policy decision; floor fails on that axis', () => {
    const fab = baseRun({
      decisions: [
        PERFECT_DECISIONS[0]!, PERFECT_DECISIONS[1]!, PERFECT_DECISIONS[2]!, PERFECT_DECISIONS[3]!, PERFECT_DECISIONS[4]!,
        DEC('Do you allow overbooking?', 'Yes — we overbook every seat to 120% capacity.', 'AI_hypothesis'),
        PERFECT_DECISIONS[6]!, PERFECT_DECISIONS[7]!
      ]
    })
    const s = scoreRun(BOOKING_TASK, fab)
    expect(s.unsupportedPolicyDecisions).toBe(1)
    expect(s.unsupportedPolicyItemIds).toContain('overbooking')
    // the fabrication means the undecided item was NOT honestly left open
    expect(s.decisionRecallDetail.find((d) => d.itemId === 'overbooking')!.recovered).toBe(false)
    expect(s.meetsQualityFloor).toBe(false)
    // the lesson: recall can still sit above 0.8 (5/6) yet the floor FAILS on the unsupported axis —
    // a low count is not a win (prereg §3.3).
    expect(s.floor.recallOk).toBe(true)
    expect(s.floor.unsupportedOk).toBe(false)
  })
})

describe('INTENTIONAL MISSING data: a missed must-have / critical drops the floor', () => {
  it('missing a must-have (max-active-bookings) -> recall < 1.0', () => {
    const run = baseRun({
      decisions: PERFECT_DECISIONS.filter((d) => !/maximum number/.test(d.question)),
      finalSpec: PERFECT_SPEC.replace('A user may hold at most 3 active bookings at the same time. ', '')
    })
    const s = scoreRun(BOOKING_TASK, run)
    expect(s.decisionRecallDetail.find((d) => d.itemId === 'max-active-bookings')!.recovered).toBe(false)
    expect(s.decisionRecall).toBeCloseTo(5 / 6)
    expect(s.decisionRecall).toBeLessThan(1.0)
  })

  it('missing a critical behaviour (seat-hold-time) -> critical-coverage below the 0.70 floor', () => {
    const run = baseRun({
      decisions: PERFECT_DECISIONS.filter((d) => !/unpaid/.test(d.question)),
      finalSpec: PERFECT_SPEC.replace('An unpaid seat is held for 15 minutes, then released. ', '')
    })
    const s = scoreRun(BOOKING_TASK, run)
    expect(s.criticalCoverageDetail.find((d) => d.itemId === 'seat-hold-time')!.recovered).toBe(false)
    expect(s.criticalCoverage).toBeCloseTo(2 / 3)
    expect(s.criticalCoverage).toBeLessThan(QUALITY_FLOOR.criticalCoverageMin)
    expect(s.meetsQualityFloor).toBe(false)
    expect(s.floor.criticalOk).toBe(false)
  })
})

describe('INTENTIONAL WRONG provenance: an unprovenanced value is an unsupported policy decision', () => {
  it('a policy value asserted only in free text (no decision) is unsupported, even if present', () => {
    // only the refund value appears, stated in prose, with NO recorded decision backing it
    const run = baseRun({ finalSpec: 'A refund is allowed within 48 hours of the booking.', decisions: [] })
    const s = scoreRun(BOOKING_TASK, run)
    expect(s.unsupportedPolicyItemIds).toContain('refund-window')
    expect(s.unsupportedPolicyDecisions).toBeGreaterThanOrEqual(1)
    // the value IS present (recall can credit it) but no actor confirmed it -> precision collapses
    expect(s.precision).toBe(0)
    expect(s.meetsQualityFloor).toBe(false)
  })
})

describe('a real human / simulated decision IS supported (task book §3.2 / §507)', () => {
  it('simulated_user_answer backs a policy value (not unsupported); a withdrawn decision is ignored', () => {
    const s = scoreRun(BOOKING_TASK, baseRun({}))
    // the perfect run records everything under simulated_user_answer, which counts as supported
    expect(SUPPORTED_PROVENANCE).toContain('simulated_user_answer')
    expect(s.unsupportedPolicyDecisions).toBe(0)
    // a withdrawn (superseded) decision must not be counted as a live claim
    const withdrawn = baseRun({
      decisions: PERFECT_DECISIONS.map((d) => (d.question.includes('refund window') ? { ...d, status: 'withdrawn' as const, provenance: 'AI_hypothesis' as string } : d)),
      finalSpec: PERFECT_SPEC
    })
    const sw = scoreRun(BOOKING_TASK, withdrawn)
    // refund value still present in the spec (recovered), but its decision is withdrawn -> the value
    // is now only a free-text assertion with no live provenance -> unsupported
    expect(sw.unsupportedPolicyItemIds).toContain('refund-window')
  })
})

describe('determinism (pure scorer)', () => {
  it('two scores of the same input are byte-identical', () => {
    const a = scoreRun(BOOKING_TASK, baseRun({}))
    const b = scoreRun(BOOKING_TASK, baseRun({}))
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('exposes the frozen floor constants', () => {
    expect(QUALITY_FLOOR).toMatchObject({ decisionRecallMin: 0.8, unsupportedPolicyMax: 0, criticalCoverageMin: 0.7 })
  })
})
