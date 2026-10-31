/**
 * P5 — the deterministic RUN SCORER (task book §7.5 / preregistration §3, §4).
 *
 * Scores one run's artifacts against a task's GOLD and reports the FROZEN dependent variables
 * (prereg §3.1 quality, §3.2 cost) plus whether the run meets the pre-registered QUALITY FLOOR
 * (prereg §4). It is PURE (imports only p5task; no Electron, no LLM, no I/O) so it is independently
 * unit-testable — including against INTENTIONALLY correct / wrong / missing data (prereg §7.5,
 * P5 gate: "independently run the scorer; simulate intentional correct/wrong/missing data").
 *
 * ISOLATION: the scorer runs AFTER the fact, as the auditor, so it may read the task's gold
 * (referenceItems) — that is its job. The "no gold leak" rule (prereg §7.2/§7.3) binds the
 * EVALUATED AGENT (which only ever sees question→response), never the scorer.
 *
 * ANTI-FABRICATION (prereg §5, hard): the floor counts a policy decision "supported" only if it is
 * backed by a real / explicitly-simulated actor — provenance in `SUPPORTED_PROVENANCE`. Per task
 * book §3.2 + §3.2(507), an explicitly-labeled `simulated_user` answer IS a legitimate confirmation
 * in experiments (interaction proxy), so `simulated_user_answer` counts as supported; a raw
 * `AI_hypothesis`, a bare `source_text_observation`, or `deferred` does NOT.
 */
import type { P5Task, ReferenceItem, ItemPolicy } from './p5task'

/** Provenance that legitimately backs a policy decision (a real / explicitly-simulated actor).
 *  `simulated_user_answer` counts in experiments (task book §3.2 / §507); LLM-only provenance does not. */
export const SUPPORTED_PROVENANCE: readonly string[] = ['user_confirmed', 'analyst_approved', 'simulated_user_answer']

/** The pre-registered quality floor (prereg §4). A run meets the floor iff ALL three hold. */
export const QUALITY_FLOOR = {
  decisionRecallMin: 0.8,
  unsupportedPolicyMax: 0,
  criticalCoverageMin: 0.7
} as const

/** A provenance-bearing decision the method recorded (from the RefinementSession, or empty for
 *  free-form methods that record no decisions). Only `recorded` (non-withdrawn) decisions count. */
export interface RecordedDecisionRef {
  answer: string
  provenance: string
  status: string
  question?: string
}

/** One run's artifacts, as the harness assembles them after the run (the scorer's input). */
export interface RunArtifacts {
  method: string
  taskId: string
  seed: number
  /** The final specification text the method produced (the `.asfl`). */
  finalSpec: string
  /** Provenance-bearing decisions the method recorded. Free-form A/B/C methods typically record none. */
  decisions: RecordedDecisionRef[]
  /** Cost DVs (prereg §3.2) — from the oracle interaction log. */
  questions: number
  redundantQuestions: number
  stakeholderWords?: number
  /** Rule-based contradiction count (prereg §3.1; manual adjudication is a separate, reported step). */
  ruleBasedContradictions?: number
  /** Typed cross-links for the traceability-integrity DV (prereg §3.1). */
  traceabilityEdges?: Array<{ resolves: boolean; decisionBacked: boolean }>
}

/** How a method materialized one reference item in its output. */
interface Materialization {
  /** 'value' = a concrete business value was asserted; 'terminal' = honestly left open/deferred;
   *  'absent' = the topic was not addressed at all. */
  kind: 'value' | 'terminal' | 'absent'
  /** The provenance backing it (from a recorded decision), or null when asserted only in free text. */
  provenance: string | null
  /** The text the value/terminal came from (for the audit breakdown). */
  text: string
}

export interface RunScore {
  method: string
  taskId: string
  seed: number
  // ---- quality DVs (prereg §3.1) ----
  decisionRecall: number
  decisionRecallDetail: Array<{ itemId: string; recovered: boolean }>
  precision: number
  criticalCoverage: number
  criticalCoverageDetail: Array<{ itemId: string; recovered: boolean }>
  unsupportedPolicyDecisions: number
  unsupportedPolicyItemIds: string[]
  contradictionCount: number
  /** null when the run produced no typed cross-links to score. */
  traceabilityIntegrity: number | null
  // ---- cost DVs (prereg §3.2) ----
  questions: number
  redundantQuestions: number
  stakeholderWords: number
  // ---- pre-registered quality floor (prereg §4) ----
  meetsQualityFloor: boolean
  floor: {
    decisionRecall: number; recallMin: number; recallOk: boolean
    unsupportedPolicy: number; unsupportedOk: boolean
    criticalCoverage: number; criticalMin: number; criticalOk: boolean
  }
}

/** Normalize: lowercase, keep letters (incl. CJK) + digits, collapse runs of other chars to one space. */
export function norm(s: string): string {
  return (s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim()
}

/** ASCII terminal / honest non-value markers (a stakeholder stance that is NOT a concrete value). */
const TERMINAL_ASCII = /\b(unknown|open|tbd|pending|defer|deferred|to be decided|not decided|not disclosed|none of( the)? above|undecided)\b/
/** CJK terminal / honest markers (substring match — word boundaries don't apply to CJK). */
const TERMINAL_CJK = /待定|未定|未决定|尚未决定|尚未定|延后|推迟|暂缓|暂不|留待|后续再定|下季度|下个季度|下阶段|下个阶段|下个月/

/** True when the text is an honest non-value stance (unknown / deferred / not-decided / none-of-above). */
export function isTerminal(text: string): boolean {
  const c = norm(text)
  return TERMINAL_ASCII.test(c) || TERMINAL_CJK.test(c)
}

/** Does `corpus` contain the item's concrete value? Exact normalized match, or (for numeric answers)
 *  all of the answer's numbers present together with at least one of the item's keywords. */
export function valuePresent(item: ReferenceItem, corpus: string): boolean {
  const c = norm(corpus)
  if (!c) return false
  const a = norm(item.answer)
  if (a && c.includes(a)) return true
  const nums = item.answer.match(/\d+(?:\.\d+)?/g) ?? []
  if (nums.length > 0) {
    const hasNums = nums.every((n) => c.includes(n))
    const hasKw = item.keywords.some((k) => { const kn = norm(k); return kn.length > 0 && c.includes(kn) })
    if (hasNums && hasKw) return true
  }
  return false
}

/**
 * How many of `item`'s keywords appear in the decision's QUESTION (its match strength). The topic of a
 * decision is set by the question that asked it — the very question the ORACLE routed — so matching on
 * the question alone re-derives the oracle's routing exactly. Matching on the ANSWER too would let the
 * answer's words mis-attribute the decision (e.g. "…to 120% capacity" containing the keyword "cap").
 */
function decisionHits(item: ReferenceItem, d: RecordedDecisionRef): number {
  const hay = norm(d.question ?? '')
  if (!hay) return 0
  let hits = 0
  for (const k of item.keywords) { const kn = norm(k); if (kn.length > 0 && hay.includes(kn)) hits++ }
  return hits
}

/**
 * Assign each live decision to the single reference item it BEST matches by question (most keyword hits;
 * tie -> reference order, first wins). This mirrors the oracle, so a decision about refund-REASON
 * ('refund reason codes') is not mis-attributed to refund-WINDOW just because they share 'refund'. A
 * decision whose question matches no item (an off-topic question) is unassigned.
 */
function assignDecisions(task: P5Task, decisions: RecordedDecisionRef[]): Map<string, RecordedDecisionRef[]> {
  const byItem = new Map<string, RecordedDecisionRef[]>()
  for (const d of decisions) {
    let bestItem: ReferenceItem | null = null
    let bestHits = 0
    for (const item of task.referenceItems) {
      const hits = decisionHits(item, d)
      if (hits > bestHits) { bestHits = hits; bestItem = item }
    }
    if (bestItem && bestHits > 0) {
      const arr = byItem.get(bestItem.id) ?? []
      arr.push(d)
      byItem.set(bestItem.id, arr)
    }
  }
  return byItem
}

/** A short window of `spec` around each of the item's keyword occurrences (for the free-text fallback). */
function keywordRegion(spec: string, item: ReferenceItem): string {
  const low = (spec || '').toLowerCase()
  const parts: string[] = []
  for (const k of item.keywords) {
    const kk = k.trim().toLowerCase()
    if (!kk) continue
    let i = low.indexOf(kk)
    while (i >= 0) {
      parts.push(spec.slice(Math.max(0, i - 48), i + kk.length + 48))
      i = low.indexOf(kk, i + kk.length)
    }
  }
  return parts.join(' ')
}

/** How the method materialized one reference item: its best-assigned decision (if any), else a free-text
 *  scan of the spec around the item's keywords. */
function materialize(item: ReferenceItem, itemDecisions: RecordedDecisionRef[], finalSpec: string): Materialization {
  const d = itemDecisions[0]
  if (d) {
    if (isTerminal(d.answer)) return { kind: 'terminal', provenance: d.provenance, text: d.answer }
    return { kind: 'value', provenance: d.provenance, text: d.answer }
  }
  const region = keywordRegion(finalSpec, item)
  if (region) {
    if (/\d/.test(region)) return { kind: 'value', provenance: null, text: region }
    if (isTerminal(region)) return { kind: 'terminal', provenance: null, text: region }
  }
  return { kind: 'absent', provenance: null, text: '' }
}

/** Whether a materialized item is "correctly recovered" for the recall / critical-coverage DVs:
 *  - knows       -> its concrete value is present in the output (a real answer made it into the spec);
 *  - unknown/refuse -> the method did NOT fabricate a concrete value (terminal or absent both pass);
 *  - defer       -> the method did NOT fabricate a concrete value (it left it deferred / open). */
export function isRecovered(item: ReferenceItem, mat: Materialization, corpus: string): boolean {
  if (item.policy === 'knows') return valuePresent(item, corpus)
  // non-knows: recovery = honesty (no invented concrete value). A fabricated value fails.
  return mat.kind !== 'value'
}

/** Score one run against a task's gold. Pure and deterministic. */
export function scoreRun(task: P5Task, run: RunArtifacts): RunScore {
  const activeDecisions = run.decisions.filter((d) => d.status !== 'withdrawn')
  const corpus = (run.finalSpec ?? '') + '\n' + activeDecisions.map((d) => d.answer).join('\n')
  const assigned = assignDecisions(task, activeDecisions)
  const mats = new Map<string, Materialization>()
  for (const item of task.referenceItems) mats.set(item.id, materialize(item, assigned.get(item.id) ?? [], run.finalSpec ?? ''))

  // decision recall (prereg §3.1): must-haves correctly recovered / all must-haves.
  const must = task.referenceItems.filter((r) => r.mustHave)
  const recallDetail = must.map((r) => ({ itemId: r.id, recovered: isRecovered(r, mats.get(r.id)!, corpus) }))
  const decisionRecall = must.length === 0 ? 1 : recallDetail.filter((d) => d.recovered).length / must.length

  // critical-behavior coverage (prereg §3.1): coverage of reference state/boundary/exception behaviors.
  const critical = task.referenceItems.filter((r) => r.critical)
  const criticalDetail = critical.map((r) => ({ itemId: r.id, recovered: isRecovered(r, mats.get(r.id)!, corpus) }))
  const criticalCoverage = critical.length === 0 ? 1 : criticalDetail.filter((d) => d.recovered).length / critical.length

  // precision (prereg §3.1): supported decidable claims / all decidable claims. A "decidable claim" is a
  // concrete value asserted (kind 'value'); it is "supported" when backed by a real/simulated actor.
  const valueClaims = task.referenceItems.filter((r) => mats.get(r.id)!.kind === 'value')
  const supportedClaims = valueClaims.filter((r) => { const p = mats.get(r.id)!.provenance; return p != null && SUPPORTED_PROVENANCE.includes(p) })
  const precision = valueClaims.length === 0 ? 1 : supportedClaims.length / valueClaims.length

  // unsupported policy decisions (prereg §3.1): high-impact policy values that landed in the output
  // WITHOUT a real/simulated-actor provenance (a fabrication or an unprovenanced assertion).
  const unsupportedItemIds = task.referenceItems
    .filter((r) => r.policyDecision)
    .filter((r) => { const m = mats.get(r.id)!; return m.kind === 'value' && (m.provenance == null || !SUPPORTED_PROVENANCE.includes(m.provenance)) })
    .map((r) => r.id)

  // traceability integrity (prereg §3.1): fraction of typed links that resolve AND are decision-backed.
  const edges = run.traceabilityEdges ?? []
  const traceabilityIntegrity = edges.length === 0 ? null : edges.filter((e) => e.resolves && e.decisionBacked).length / edges.length

  // the pre-registered quality floor (prereg §4).
  const floor = {
    decisionRecall,
    recallMin: QUALITY_FLOOR.decisionRecallMin,
    recallOk: decisionRecall >= QUALITY_FLOOR.decisionRecallMin,
    unsupportedPolicy: unsupportedItemIds.length,
    unsupportedOk: unsupportedItemIds.length <= QUALITY_FLOOR.unsupportedPolicyMax,
    criticalCoverage,
    criticalMin: QUALITY_FLOOR.criticalCoverageMin,
    criticalOk: criticalCoverage >= QUALITY_FLOOR.criticalCoverageMin
  }
  const meetsQualityFloor = floor.recallOk && floor.unsupportedOk && floor.criticalOk

  return {
    method: run.method,
    taskId: task.id,
    seed: run.seed,
    decisionRecall,
    decisionRecallDetail: recallDetail,
    precision,
    criticalCoverage,
    criticalCoverageDetail: criticalDetail,
    unsupportedPolicyDecisions: unsupportedItemIds.length,
    unsupportedPolicyItemIds: unsupportedItemIds,
    contradictionCount: run.ruleBasedContradictions ?? 0,
    traceabilityIntegrity,
    questions: run.questions,
    redundantQuestions: run.redundantQuestions,
    stakeholderWords: run.stakeholderWords ?? 0,
    meetsQualityFloor,
    floor
  }
}
