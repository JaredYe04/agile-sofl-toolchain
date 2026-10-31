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

/**
 * Pilot scenario #2 — e-commerce order / inventory (task book §7.1 domain "e-commerce / order /
 * inventory: cross-process data consistency"). Independently authored; the gold is the researcher's
 * decision of what a correct order-inventory spec must decide. It deliberately mixes the four
 * stakeholder stances so the oracle exercises knows / unknown / refuse / defer:
 *   - inventory floor (knows, policy)
 *   - refund processing window (knows, policy)
 *   - price calculation (knows, critical boundary)
 *   - low-stock notification threshold (knows, policy)
 *   - oversell behavior (unknown — the stakeholder has not decided it)
 *   - discount stacking (refuse — a private commercial decision)
 *   - stock release timing on cancellation (defer — deferred to a later term)
 */
export const ECOMMERCE_TASK: P5Task = {
  id: 'ecommerce-01',
  domain: 'ecommerce',
  language: 'en',
  initialRoughStory:
    'Build a system where customers place orders against a live inventory. An order holds the stock ' +
    'it needs, the stock must stay consistent with what is really available, and cancellations and ' +
    'refunds have to keep the stock and the payment in step. The merchant wants sensible business ' +
    'rules, but several of the details (how much stock is kept in reserve, how refunds are processed, ' +
    'whether the system may ever sell more than it has, when held stock is released after a ' +
    'cancellation, how the final price is computed, and any discount or promotion rules) have not all ' +
    'been settled yet. Ask the stakeholder where a decision is genuinely needed and do not invent a ' +
    'concrete business value on your own.',
  stakeholderProfile:
    'A merchant operations lead who knows the inventory floor, the refund processing window, the price ' +
    'calculation rule, and the low-stock notification threshold. They have NOT decided the oversell ' +
    'behavior, they will not disclose discount-stacking policy, and they are deferring the stock-release ' +
    'timing on cancellation to next term.',
  referenceItems: [
    {
      id: 'inventory-floor',
      statement: 'A floor of 10 units of every SKU is held in reserve and never sold.',
      answer: 'a floor of 10 units is held in reserve',
      keywords: ['inventory floor', 'reserve', 'buffer stock', 'safety stock', '保留库存', '安全库存'],
      topicPhrase: 'the inventory floor kept in reserve',
      policy: 'knows',
      mustHave: true,
      policyDecision: true
    },
    {
      id: 'refund-processing',
      statement: 'A refund is processed to the customer within 5 business days of the return approval.',
      answer: 'processed within 5 business days of return approval',
      keywords: ['refund', 'refund processing', 'business days', '退款处理', '退款周期'],
      topicPhrase: 'how quickly a refund is processed',
      policy: 'knows',
      mustHave: true,
      policyDecision: true
    },
    {
      id: 'oversell',
      statement: 'OVERSELL BEHAVIOR IS UNDECIDED — the stakeholder does not know whether to oversell.',
      answer: 'unknown',
      keywords: ['oversell', 'over-sell', 'sell more than', 'in stock', '超卖'],
      topicPhrase: 'whether the system may sell more than it has in stock',
      policy: 'unknown',
      mustHave: true,
      policyDecision: true
    },
    {
      id: 'stock-release',
      statement: 'STOCK-RELEASE TIMING on cancellation is DEFERRED to next term (not decided now).',
      answer: 'defer',
      keywords: ['stock release', 'held stock', 'after a cancellation', '释放库存'],
      topicPhrase: 'when held stock is released back to inventory after a cancellation',
      policy: 'defer',
      policyDecision: true
    },
    {
      id: 'price-calc',
      statement: 'The final price is unit price times quantity, plus 10% tax, plus a flat 5 shipping fee when the pre-tax total is under 50.',
      answer: 'unit price times quantity plus 10% tax plus flat 5 shipping under 50',
      keywords: ['price calculation', 'final price', 'price', 'calculated', 'tax', 'shipping fee', '定价', '税费', '运费'],
      topicPhrase: 'how the final order price is calculated',
      policy: 'knows',
      mustHave: true,
      critical: true
    },
    {
      id: 'low-stock',
      statement: 'The system raises a low-stock alert when an available quantity drops to or below 20 units.',
      answer: 'an alert is raised when available quantity drops to 20 or below',
      keywords: ['low stock', 'running low', 'threshold', 'reorder point', 'restock', '低库存', '补货点'],
      topicPhrase: 'the threshold at which the system warns that stock is running low',
      policy: 'knows',
      mustHave: true,
      policyDecision: true
    },
    {
      id: 'discount-stacking',
      statement: 'DISCOUNT-STACKING is a private commercial decision the stakeholder will not disclose.',
      answer: 'none_of_above',
      keywords: ['discount', 'coupon', 'promo', 'promotion', 'stack', '折扣', '优惠券', '促销'],
      topicPhrase: 'whether discounts can be combined',
      policy: 'refuse',
      policyDecision: true
    }
  ],
  complexityTags: {
    treeBreadth: 7,
    treeDepth: 2,
    interdependency: 'low',
    number_of_critical_decisions: 3
  }
}

/**
 * Pilot scenario #3 — task management (task book §7.1 domain "task management: roles, dependencies,
 * delete/restore"). Independently authored; the gold is the researcher's decision of what a correct
 * task-management spec must decide. It deliberately mixes the four stakeholder stances so the oracle
 * exercises knows / unknown / refuse / defer:
 *   - archived-task limit (knows, policy)
 *   - task expiration (knows, critical boundary)
 *   - assignment permission (knows, policy)
 *   - delete guard for subtasks (knows, critical state)
 *   - dependency cascade on delete (knows, critical state)
 *   - restore behavior (knows, boundary)
 *   - activity-log retention (defer — deferred to a later term)
 *   - priority scheme (refuse — a private commercial decision)
 *   - subtask cap (unknown — the stakeholder has not decided it)
 */
export const TASKMGMT_TASK: P5Task = {
  id: 'taskmgmt-01',
  domain: 'taskmanagement',
  language: 'en',
  initialRoughStory:
    'Build a system where a team creates, assigns, and tracks tasks. A task has an assignee, an ' +
    'optional deadline, and can depend on other tasks and contain subtasks. Tasks can be archived and ' +
    'deleted, and a deleted task may be restored. The team lead wants sensible business rules, but ' +
    'several of the details (who may assign a task, when an unworked task expires, what happens to a ' +
    'task with active subtasks when it is deleted, how a task is restored after deletion, how many ' +
    'tasks may be archived, and any priority or ranking behaviour) have not all been settled yet. Ask ' +
    'the stakeholder where a decision is genuinely needed and do not invent a concrete business value ' +
    'on your own.',
  stakeholderProfile:
    'A team lead who knows the archived-task limit, the task expiration rule, the assignment ' +
    'permission, the delete guard for tasks with subtasks, the dependency-cascade rule, and the ' +
    'restore window. They have NOT decided the subtask cap, they are deferring activity-log retention ' +
    'to next term, and they will not disclose the priority scheme.',
  referenceItems: [
    {
      id: 'archive-limit',
      statement: 'A user may keep at most 5 archived tasks; the 6th archive fails until one is deleted.',
      answer: 'at most 5 archived tasks at the same time',
      keywords: ['archive limit', 'archived tasks', 'archived', '归档上限', '已归档'],
      topicPhrase: 'how many archived tasks a user may keep',
      policy: 'knows',
      mustHave: true,
      policyDecision: true
    },
    {
      id: 'task-expiration',
      statement: 'A task with no activity for 30 days is auto-marked expired and moves out of the active list.',
      answer: 'after 30 days without activity',
      keywords: ['expire', 'expiration', 'inactive', 'auto-close', '过期', '未活动'],
      topicPhrase: 'when a task is marked expired',
      policy: 'knows',
      mustHave: true,
      critical: true
    },
    {
      id: 'assignment',
      statement: 'A task may be assigned to any team member, including the task creator.',
      answer: 'any team member, including the creator',
      keywords: ['assign', 'assignment', 'assignee', '分配', '指派'],
      topicPhrase: 'who a task may be assigned to',
      policy: 'knows',
      mustHave: true,
      policyDecision: true
    },
    {
      id: 'delete-guard',
      statement: 'A task with active subtasks cannot be deleted until its subtasks are completed or re-parented.',
      answer: 'a task with active subtasks cannot be deleted',
      keywords: ['can be deleted', 'delete task', 'guard', 'prevent delete', '删除任务', '删除保护'],
      topicPhrase: 'whether a task with subtasks can be deleted',
      policy: 'knows',
      mustHave: true,
      critical: true
    },
    {
      id: 'dependency-cascade',
      statement: 'When a task is deleted, its dependents are re-parented to the deleted task parent.',
      answer: 'its dependents are re-parented to the deleted task parent',
      keywords: ['dependents', 'cascade', 're-parent', 'reparent', '依赖', '级联'],
      topicPhrase: 'what happens to a task dependents when it is deleted',
      policy: 'knows',
      mustHave: true,
      critical: true
    },
    {
      id: 'restore',
      statement: 'A deleted task can be restored within 7 days of deletion; after 7 days it is gone permanently.',
      answer: 'within 7 days of deletion',
      keywords: ['restore', 'undo delete', 'recover', '恢复', '撤销删除'],
      topicPhrase: 'how long a deleted task can be restored',
      policy: 'knows',
      mustHave: true
    },
    {
      id: 'activity-log-retention',
      statement: 'ACTIVITY-LOG RETENTION is DEFERRED to next term (not decided now).',
      answer: 'defer',
      keywords: ['activity history', 'activity', 'kept', 'retention', 'audit log', '活动日志', '保留'],
      topicPhrase: 'how long task activity history is kept',
      policy: 'defer',
      policyDecision: true
    },
    {
      id: 'priority-scheme',
      statement: 'PRIORITY SCHEME is a private commercial decision the stakeholder will not disclose.',
      answer: 'none_of_above',
      keywords: ['priority', 'ranking', 'weight', '优先级', '排序'],
      topicPhrase: 'how tasks are ranked by priority',
      policy: 'refuse',
      policyDecision: true
    },
    {
      id: 'subtask-cap',
      statement: 'SUBTASK CAP IS UNDECIDED — the stakeholder does not know the limit.',
      answer: 'unknown',
      keywords: ['subtask', 'sub-task', 'children', '子任务'],
      topicPhrase: 'how many subtasks a task may have',
      policy: 'unknown',
      mustHave: true
    }
  ],
  complexityTags: {
    treeBreadth: 9,
    treeDepth: 3,
    interdependency: 'medium',
    number_of_critical_decisions: 3
  }
}

/** The pilot set (3 required for the pilot; more are authored in P5 as the set grows). */
export const P5_TASKS: Record<string, P5Task> = {
  'booking-01': BOOKING_TASK,
  'ecommerce-01': ECOMMERCE_TASK,
  'taskmgmt-01': TASKMGMT_TASK
}

/** Load a task by id; throws if unknown (fail fast, not a silent default). */
export function getP5Task(id: string): P5Task {
  const t = P5_TASKS[id]
  if (!t) throw new Error(`Unknown P5 task '${id}'. Known: ${Object.keys(P5_TASKS).join(', ')}`)
  return t
}
