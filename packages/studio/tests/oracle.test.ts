/**
 * P5 gate tests for the deterministic simulated-stakeholder ORACLE (task book §7.3 / prereg §7.3).
 *
 * The oracle is the ONLY reader of a task's gold and the experiment's stand-in stakeholder. These
 * tests are the anti-fabrication / isolation contract: it must (a) distinguish knows / unknown /
 * refuse / defer, (b) never invent a value for an irrelevant question, (c) leak NO gold beyond the
 * stakeholder's own answer, (d) be deterministic AND seed-reproducible, and (e) log every answer.
 * It is pure (oracle.ts imports only p5task + schedule), so NO electron mock is needed here.
 */
import { describe, it, expect } from 'vitest'
import { StakeholderOracle, ORACLE_UNMATCHED } from '../scripts/agent-harness/oracle'
import { BOOKING_TASK } from '../scripts/agent-harness/p5task'

const o = () => new StakeholderOracle(BOOKING_TASK)

describe('stance routing (knows / unknown / refuse / defer)', () => {
  it('knows: returns the concrete stakeholder value, not the gold statement', () => {
    const s = o()
    const a = s.resolve({ question: 'What is the refund window?' })
    expect(a.stance).toBe('knows')
    expect(a.matchedItemIds).toContain('refund-window')
    expect(a.unmatched).toBe(false)
    // the stakeholder's real answer, not the isolated gold statement
    expect(a.text).toBe('within 48 hours of the booking')
    expect(a.text).not.toBe(BOOKING_TASK.referenceItems[0].statement)
  })

  it('unknown: the stakeholder has not decided (overbooking)', () => {
    const a = o().resolve({ question: 'Do you allow overbooking?' })
    expect(a.stance).toBe('unknown')
    expect(a.matchedItemIds).toContain('overbooking')
    expect(a.text).toBe('unknown')
  })

  it('refuse: a private decision the stakeholder will not disclose (loyalty/discount)', () => {
    const a = o().resolve({ question: 'Do you have loyalty discounts?' })
    expect(a.stance).toBe('refuse')
    expect(a.matchedItemIds).toContain('loyalty-discount')
    expect(a.text).toBe('none_of_above')
  })

  it('defer: a decision deferred to a later term (refund-reason)', () => {
    const a = o().resolve({ question: 'What refund reason codes do you use?' })
    // 'refund reason' + 'reason code' (2 hits) beats refund-window's 'refund' (1 hit)
    expect(a.stance).toBe('defer')
    expect(a.matchedItemIds).toContain('refund-reason')
    expect(a.text).toBe('defer')
  })

  it('best match = most keyword hits (deterministic tiebreak by reference order)', () => {
    const a = o().resolve({ question: 'What is the maximum number of bookings per user?' })
    expect(a.matchedItemIds[0]).toBe('max-active-bookings')
    expect(a.text).toBe('at most 3 active bookings at the same time')
  })
})

describe('irrelevant questions -> no invented value (anti-fabrication)', () => {
  it('unmatched: irrelevant question gets the sentinel, never a concrete value', () => {
    const a = o().resolve({ question: 'How do I pay with a credit card?' })
    expect(a.unmatched).toBe(true)
    expect(a.matchedItemIds).toEqual([])
    expect(a.stance).toBe('unknown')
    expect(a.text).toBe(ORACLE_UNMATCHED)
    expect(a.text.toLowerCase()).not.toMatch(/48 hours|15 minutes|at most 3|before the event/)
  })
})

describe('bilingual routing (English + 中文)', () => {
  it('routes a Chinese question to the right item', () => {
    expect(o().resolve({ question: '你能超售吗？' }).matchedItemIds).toContain('overbooking')
    expect(o().resolve({ question: '退款窗口是多久？' }).matchedItemIds).toContain('refund-window')
    expect(o().resolve({ question: '一张座位最多几个人同时订？' }).matchedItemIds).toContain('max-active-bookings')
  })
})

describe('no gold leak', () => {
  it('the exposed text is only the stakeholder answer (or the sentinel) — never the gold statement / profile', () => {
    const s = o()
    for (const q of [
      'What is the refund window?',
      'Do you allow overbooking?',
      'Do you have loyalty discounts?',
      'What refund reason codes do you use?',
      'How do I pay with a credit card?'
    ]) {
      const a = s.resolve({ question: q })
      const profile = BOOKING_TASK.stakeholderProfile
      const statements = BOOKING_TASK.referenceItems.map((r) => r.statement)
      expect(a.text).not.toBe(profile)
      for (const st of statements) expect(a.text).not.toBe(st)
    }
  })
})

describe('full interaction log (prereg §7.3: every answer, basis, count)', () => {
  it('records each question with a 1-based count, stance, basis, and matched items', () => {
    const s = o()
    s.resolve({ question: 'What is the refund window?', obligationId: 'ob-refund' })
    s.resolve({ question: 'Do you allow overbooking?', obligationId: 'ob-ovb' })
    expect(s.questionCount).toBe(2)
    expect(s.log).toHaveLength(2)
    expect(s.log[0]).toMatchObject({ n: 1, obligationId: 'ob-refund', answer: { stance: 'knows' } })
    expect(s.log[1]).toMatchObject({ n: 2, obligationId: 'ob-ovb', answer: { stance: 'unknown' } })
    expect(s.log[0].answer.basis).toMatch(/refund-window/)
  })

  it('counts redundant re-asks of a settled item', () => {
    const s = o()
    expect(s.redundantQuestions).toBe(0)
    s.resolve({ question: 'What is the refund window?' })
    expect(s.redundantQuestions).toBe(0)
    s.resolve({ question: 'Just to confirm — what is the refund window?' })
    expect(s.redundantQuestions).toBe(1)
  })
})

describe('deterministic AND seed-reproducible (prereg §7.3)', () => {
  it('deterministic mode: two fresh oracles give byte-identical answers for the same sequence', () => {
    const seq = [
      'What is the refund window?',
      'Do you allow overbooking?',
      'Do you have loyalty discounts?',
      'How do I pay with a credit card?'
    ]
    const a = o()
    const b = o()
    for (const q of seq) {
      expect(a.resolve({ question: q }).text).toBe(b.resolve({ question: q }).text)
    }
  })

  it('random mode, same seed: reproducible; the VALUE is preserved, only the surface varies', () => {
    const seq = [
      'What is the refund window?',
      'Do you allow overbooking?',
      'What is the maximum number of bookings per user?'
    ]
    const a = new StakeholderOracle(BOOKING_TASK, { mode: 'random', seed: 42 })
    const b = new StakeholderOracle(BOOKING_TASK, { mode: 'random', seed: 42 })
    const textsA = seq.map((q) => a.resolve({ question: q }).text)
    const textsB = seq.map((q) => b.resolve({ question: q }).text)
    expect(textsA).toEqual(textsB)
    // the concrete value survives the surface re-phrasing; the stakeholder answer is intact
    expect(textsA[0]).toContain('within 48 hours of the booking')
    expect(textsA[2]).toContain('at most 3 active bookings')
    // non-knows stances stay bare terminal keywords even in random mode (no wrapping)
    expect(textsA[1]).toBe('unknown')
  })

  it('random mode, different seed: surface may differ while the value is preserved', () => {
    const a = new StakeholderOracle(BOOKING_TASK, { mode: 'random', seed: 1 })
    const b = new StakeholderOracle(BOOKING_TASK, { mode: 'random', seed: 2 })
    const ta = a.resolve({ question: 'What is the refund window?' }).text
    const tb = b.resolve({ question: 'What is the refund window?' }).text
    expect(ta).toContain('within 48 hours of the booking')
    expect(tb).toContain('within 48 hours of the booking')
  })
})
