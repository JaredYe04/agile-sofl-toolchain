/**
 * P5 research benchmark — the frozen task schema (preregistration §7.5, task book §7.1).
 *
 * A P5Task is one independently-audited scenario. It is the unit the oracle (oracle.ts) answers
 * from and the scorer (scorer.ts) scores against. CRITICAL ISOLATION (prereg §7.2/§7.3, hard
 * anti-fabrication rule): everything except `initialRoughStory` is GOLD and is isolated behind the
 * oracle's controlled interface — the evaluated agent sees ONLY question→response and never reads
 * this file's reference items, keywords, or the stakeholder profile. The oracle is the only reader.
 *
 * The content (the reference items below) is authored by the researcher, NOT derived from any
 * evaluated method's output (task book §7.1: "不能用被测 Agent 的输出来定义标准答案").
 */

/** How the simulated stakeholder responds when a given reference item is asked (prereg §7.3: the
 *  oracle MUST distinguish knows / does-not-know / refuses / defers). The reply the harness records
 *  is a TERMINAL KEYWORD for the non-knows cases (so the P4 recording path maps it to the honest
 *  decision kind and fabricates nothing): unknown -> 'unknown', defer -> 'defer', refuse ->
 *  'none_of_above'; 'knows' returns the concrete value. */
export type ItemPolicy = 'knows' | 'unknown' | 'refuse' | 'defer'

export interface ReferenceItem {
  id: string
  /** The GOLD statement (isolated; the agent never sees it). */
  statement: string
  /** The concrete value the simulated stakeholder gives when this is asked (a real value, kind
   *  'answer' through the P4 recording path). Only used when policy === 'knows'. */
  answer: string
  /** Matching cues (English + Chinese, case-insensitive substrings). An incoming QUESTION containing
   *  any of these is considered "about" this item. These are matching cues, not the gold value — the
   *  agent never sees them; only the oracle uses them to route the question. */
  keywords: string[]
  /** A neutral, researcher-authored topic phrase (a QUESTION, never the gold value): used by the
   *  deterministic mock driver (p5methods.ts) to label the requirement node and to word the
   *  clarification question. It mirrors the open topics already named in `initialRoughStory`, so no
   *  gold is exposed — the concrete value still comes only from the oracle. */
  topicPhrase: string
  /** The stakeholder's stance when this is asked. */
  policy: ItemPolicy
  /** Counts toward decision RECALL (a "must-have" the method should recover). */
  mustHave?: boolean
  /** A state/boundary/exception behavior; counts toward CRITICAL-BEHAVIOR coverage. */
  critical?: boolean
  /** A high-impact policy decision; if it lands in the final spec without user/simulated confirmation
   *  it counts toward UNSUPPORTED-POLICY-DECISIONS (prereg §3.1). */
  policyDecision?: boolean
}

export interface P5Task {
  id: string
  domain: string
  /** Story language (informational; matching is language-agnostic because keywords are bilingual). */
  language: 'en' | 'zh'
  /** The ONLY field visible to every evaluated method. */
  initialRoughStory: string
  /** The simulated stakeholder's character / what they know (isolated; drives the oracle only). */
  stakeholderProfile: string
  /** The independently-audited gold (isolated). */
  referenceItems: ReferenceItem[]
  /** Complexity tags (prereg §7.1 / task book §7.1): pre-defined subgroup-analysis axes. */
  complexityTags: Record<string, string | number>
}

/**
 * Pilot scenario #1 — seat/event booking (task book §7.1 domain "Booking / cancellation / refund:
 * state, time boundary, exception policy"). Independently authored; the gold below is the researcher's
 * decision of what a correct booking spec must decide. It deliberately mixes the four stakeholder
 * stances so the oracle exercises knows / unknown / refuse / defer:
 *   - refund window (knows, critical policy)
 *   - max active bookings per user (knows, policy)
 *   - unconfirmed-seat hold time (knows, critical boundary)
 *   - no double-booking of a seat/slot (knows, critical state)
 *   - cancellation before start (knows, policy)
 *   - overbooking (unknown — the stakeholder has not decided it)
 *   - loyalty/discount (refuse — a private commercial decision)
 *   - refund-reason categories (defer — deferred to a later term)
 */
export const BOOKING_TASK: P5Task = {
  id: 'booking-01',
  domain: 'booking',
  language: 'en',
  initialRoughStory:
    'Build a system where customers can reserve a seat for an event. A customer browses available seats, ' +
    'reserves one, pays, and can later cancel. The organizer wants a few sensible business rules, but many ' +
    'of the details (refund timing, how many seats a person may hold, what happens to a seat that is reserved ' +
    'but never paid, whether two people can grab the same seat, when a booking may be cancelled, and any ' +
    'discount or loyalty behaviour) have not all been settled yet. Ask the stakeholder where a decision is ' +
    'genuinely needed and do not invent a concrete business value on your own.',
  stakeholderProfile:
    'A product owner who knows the refund window, the per-user booking cap, the unconfirmed-seat hold time, ' +
    'the no-double-booking rule, and the cancellation cutoff. They have NOT decided overbooking, they will not ' +
    'disclose loyalty/discount policy, and they are deferring the refund-reason categories to next term.',
  referenceItems: [
    {
      id: 'refund-window',
      statement: 'A refund is allowed only within 48 hours of the booking; after 48 hours no refund.',
      answer: 'within 48 hours of the booking',
      keywords: ['refund', '退款', 'money back', 'reimburse'],
      topicPhrase: 'refund timing',
      policy: 'knows',
      mustHave: true,
      critical: true,
      policyDecision: true
    },
    {
      id: 'max-active-bookings',
      statement: 'A single user may hold at most 3 active (unexpired) bookings at the same time.',
      answer: 'at most 3 active bookings at the same time',
      keywords: ['how many', 'maximum', 'cap', 'limit', 'per user', 'at a time', '同时', '上限'],
      topicPhrase: 'the maximum per-user cap on active bookings',
      policy: 'knows',
      mustHave: true,
      policyDecision: true
    },
    {
      id: 'seat-hold-time',
      statement: 'A seat that is reserved but not yet paid is held for 15 minutes, then released to others.',
      answer: 'held for 15 minutes, then released',
      keywords: ['hold', 'unpaid', 'unconfirmed', 'expire', 'release', 'minutes', '保留', '超时'],
      topicPhrase: 'how long an unpaid seat is held before release',
      policy: 'knows',
      mustHave: true,
      critical: true
    },
    {
      id: 'no-double-booking',
      statement: 'The same seat cannot be booked by two users for the same event time slot.',
      answer: 'a seat cannot be booked by two users for the same time slot',
      keywords: ['double', 'conflict', 'same seat', 'two users', 'duplicate', '并发', '冲突', '重复'],
      topicPhrase: 'whether two people can book the same seat at the same time',
      policy: 'knows',
      mustHave: true,
      critical: true
    },
    {
      id: 'cancel-cutoff',
      statement: 'A customer may cancel a booking only before the event start time.',
      answer: 'cancellation is allowed only before the event start time',
      keywords: ['cancel', 'before', 'start time', 'cutoff', '取消', '开始前'],
      topicPhrase: 'when a booking may be cancelled',
      policy: 'knows',
      mustHave: true,
      policyDecision: true
    },
    {
      id: 'overbooking',
      statement: 'OVERBOOKING IS UNDECIDED — the stakeholder does not know whether to overbook.',
      answer: 'unknown',
      keywords: ['overbook', 'over-booking', 'oversell', '超售'],
      topicPhrase: 'whether the system should ever overbook',
      policy: 'unknown',
      mustHave: true,
      policyDecision: true
    },
    {
      id: 'loyalty-discount',
      statement: 'LOYALTY/DISCOUNT POLICY is a private commercial decision the stakeholder will not disclose.',
      answer: 'none_of_above',
      keywords: ['loyalty', 'discount', 'points', 'rewards', '积分', '折扣', '会员'],
      topicPhrase: 'any discount or loyalty behaviour',
      policy: 'refuse',
      policyDecision: true
    },
    {
      id: 'refund-reason',
      statement: 'REFUND-REASON CATEGORIES are DEFERRED to next term (not decided now).',
      answer: 'defer',
      keywords: ['refund reason', 'reason code', 'why refund', '退款原因'],
      topicPhrase: 'what refund reason codes a customer can choose',
      policy: 'defer',
      policyDecision: true
    }
  ],
  complexityTags: {
    treeBreadth: 8,
    treeDepth: 2,
    interdependency: 'low',
    number_of_critical_decisions: 6
  }
}

/** The pilot set so far (3 required for the pilot; more are authored in P5 as the set grows). */
export const P5_TASKS: Record<string, P5Task> = {
  'booking-01': BOOKING_TASK
}

/** Load a task by id; throws if unknown (fail fast, not a silent default). */
export function getP5Task(id: string): P5Task {
  const t = P5_TASKS[id]
  if (!t) throw new Error(`Unknown P5 task '${id}'. Known: ${Object.keys(P5_TASKS).join(', ')}`)
  return t
}
