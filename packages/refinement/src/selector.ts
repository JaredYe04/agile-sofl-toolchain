/**
 * Cost-aware clarification selection (conceptual-model section 7; hypothesis under test, RQ3).
 *
 * `priority(q) = expected_quality_gain(q) / (estimated_user_effort(q) + ε)`, with an explicit
 * **minimum-risk gate** so a high-impact policy question is never pushed to the bottom by the division.
 *
 * The gain/cost terms are **heuristic estimates to be calibrated** — this policy is a hypothesis, not
 * established theory (RQ3 ablation compares it against the SAGE-Agent EVPI−Cost form, which P5 builds on
 * top of these same components). The *measured* cost in the benchmark is the simulated stakeholder's
 * actual interaction count, not the estimate produced here.
 *
 * Deterministic: same graph + engine + candidates + context => same ranking (stable tie-break by id).
 */
import type { ClarificationCandidate } from './types.js'
import type { RequirementGraph } from './graph.js'
import type { ObligationEngine } from './obligations.js'

export interface SelectorWeights {
  /** Benefit per open critical obligation the candidate addresses. */
  criticalObligation: number
  /** Benefit per unit of criticality summed over the candidate's target nodes. */
  criticality: number
  /** Benefit per cross-link touching a target node (cross-node impact). */
  crossLink: number
  /** Flat benefit bonus when the candidate is a blocking prerequisite. */
  blocking: number
  /** Benefit penalty per prior re-ask of this candidate. */
  reAskPenalty: number
  /** Base effort cost of asking one question. */
  baseCost: number
  /** Effort cost per offered choice option. */
  optionCost: number
  /** Effort cost when free text is required. */
  freeTextCost: number
  /** Score floor applied to high-impact policy questions (the minimum-risk gate). */
  minRiskGate: number
}

export const DEFAULT_WEIGHTS: SelectorWeights = {
  criticalObligation: 2,
  criticality: 1,
  crossLink: 0.5,
  blocking: 1.5,
  reAskPenalty: 0.75,
  baseCost: 1,
  optionCost: 0.5,
  freeTextCost: 1,
  minRiskGate: 1.5,
}

export interface SelectionContext {
  /** Remaining clarification budget (# questions still affordable). `<= 0` => stop (no selection). */
  budgetRemaining?: number
  /** Current stage label (informational; surfaced in the priority reason). */
  stage?: string
  /** candidate id -> # prior re-asks of that candidate. */
  reAskCounts?: Record<string, number>
  /** Numerical ε for the division (avoids divide-by-zero on a zero-cost question). */
  epsilon?: number
}

export interface ScoredCandidate {
  candidate: ClarificationCandidate
  /** The gated priority value: benefit / (cost + ε), floored by the min-risk gate if high-impact. */
  score: number
  /** The derived expected quality gain (before division). */
  benefit: number
  /** The derived estimated user effort (before division). */
  cost: number
  /** True when the minimum-risk gate was applied (high-impact policy). */
  gated: boolean
  /** Explainable reasons the candidate was prioritized (surfaced in the UI). */
  reasons: string[]
}

export interface BenefitBreakdown {
  benefit: number
  reasons: string[]
}

/** Derived benefit for a candidate (the expected quality gain estimate), with an explainable breakdown. */
export function computeBenefit(
  candidate: ClarificationCandidate,
  graph: RequirementGraph,
  engine: ObligationEngine,
  ctx: SelectionContext,
  w: SelectorWeights,
): BenefitBreakdown {
  let benefit = 0
  const reasons: string[] = []

  // # open critical obligations addressed.
  let openCritical = 0
  for (const oid of candidate.obligationIds) {
    const o = engine.get(oid)
    if (o && (o.status === 'open' || o.status === 'disputed') && o.severity === 'critical') openCritical++
  }
  if (openCritical > 0) {
    benefit += w.criticalObligation * openCritical
    reasons.push(`addresses ${openCritical} open critical obligation${openCritical > 1 ? 's' : ''}`)
  }

  // criticality + cross-node impact of target nodes.
  let critSum = 0
  let crossLinks = 0
  for (const nid of candidate.targetNodeIds) {
    const n = graph.getNode(nid)
    if (!n) continue
    critSum += n.criticality
    crossLinks += graph.allEdges().filter((e) => e.kind !== 'refines' && (e.source === nid || e.target === nid)).length
  }
  if (critSum > 0) benefit += w.criticality * critSum
  if (crossLinks > 0) {
    benefit += w.crossLink * crossLinks
    reasons.push(`${crossLinks} cross-link${crossLinks > 1 ? 's' : ''} on target (cross-node impact)`)
  }

  // blocking prerequisite.
  if (isBlockingPrerequisite(candidate, graph, engine)) {
    benefit += w.blocking
    reasons.push('blocking prerequisite')
  }

  // re-ask penalty.
  const reAsks = ctx.reAskCounts?.[candidate.id] ?? 0
  if (reAsks > 0) {
    benefit -= w.reAskPenalty * reAsks
    reasons.push(`re-asked ${reAsks}× (discounted)`)
  }

  return { benefit: Math.max(0, benefit), reasons }
}

/** A candidate is a blocking prerequisite if a target is blocked, or it addresses an open critical policy. */
export function isBlockingPrerequisite(
  candidate: ClarificationCandidate,
  graph: RequirementGraph,
  engine: ObligationEngine,
): boolean {
  for (const nid of candidate.targetNodeIds) {
    if (graph.getNode(nid)?.status === 'blocked') return true
  }
  for (const oid of candidate.obligationIds) {
    const o = engine.get(oid)
    if (o && o.policyRequired && o.severity === 'critical' && (o.status === 'open' || o.status === 'disputed')) return true
  }
  return false
}

/** Derived effort cost for a candidate (the estimated user effort estimate). */
export function computeCost(candidate: ClarificationCandidate, w: SelectorWeights): number {
  const opts = candidate.choiceOptions?.length ?? 0
  let cost = w.baseCost + w.optionCost * opts
  if (candidate.supportsFreeText) cost += w.freeTextCost
  return Math.max(0, cost)
}

/** Score one candidate (benefit / (cost + ε)), applying the min-risk gate for high-impact policy. */
export function scoreCandidate(
  candidate: ClarificationCandidate,
  graph: RequirementGraph,
  engine: ObligationEngine,
  ctx: SelectionContext,
  w: SelectorWeights = DEFAULT_WEIGHTS,
): ScoredCandidate {
  const { benefit, reasons: benefitReasons } = computeBenefit(candidate, graph, engine, ctx, w)
  const cost = computeCost(candidate, w)
  const epsilon = ctx.epsilon ?? 1e-6
  let score = benefit / (cost + epsilon)
  const gated = candidate.isHighImpactPolicy
  if (gated) score = Math.max(score, w.minRiskGate)

  const reasons: string[] = []
  if (candidate.priorityReason && candidate.priorityReason.length > 0) reasons.push(candidate.priorityReason)
  reasons.push(...benefitReasons)
  reasons.push(`benefit ${benefit.toFixed(2)} / cost ${cost.toFixed(2)}`)
  if (gated) reasons.push('high-impact policy: minimum-risk gate applied')
  if (ctx.stage) reasons.push(`stage: ${ctx.stage}`)

  return { candidate, score, benefit, cost, gated, reasons }
}

/**
 * Rank all eligible candidates (best first, stable by id). A candidate is eligible when its `eligibleState`
 * is 'any' or matches at least one target node's current status.
 */
export function rankCandidates(
  candidates: ClarificationCandidate[],
  graph: RequirementGraph,
  engine: ObligationEngine,
  ctx: SelectionContext = {},
  weights: SelectorWeights = DEFAULT_WEIGHTS,
): ScoredCandidate[] {
  const scored = candidates
    .filter((c) => isEligible(c, graph))
    .map((c) => scoreCandidate(c, graph, engine, ctx, weights))
  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.candidate.id < b.candidate.id ? -1 : 1))
  return scored
}

/** The single next clarification to ask (top of the ranking), or null when the budget is exhausted. */
export function selectNext(
  candidates: ClarificationCandidate[],
  graph: RequirementGraph,
  engine: ObligationEngine,
  ctx: SelectionContext = {},
  weights: SelectorWeights = DEFAULT_WEIGHTS,
): ScoredCandidate | null {
  if (ctx.budgetRemaining !== undefined && ctx.budgetRemaining <= 0) return null
  const ranked = rankCandidates(candidates, graph, engine, ctx, weights)
  return ranked[0] ?? null
}

/** Eligible iff `eligibleState` is 'any', or some target node is currently in that status. */
function isEligible(candidate: ClarificationCandidate, graph: RequirementGraph): boolean {
  if (candidate.eligibleState === 'any') return true
  return candidate.targetNodeIds.some((nid) => graph.getNode(nid)?.status === candidate.eligibleState)
}
