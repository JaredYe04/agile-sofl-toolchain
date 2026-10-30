import { describe, expect, it } from 'vitest'
import {
  RequirementGraph,
  deterministicIdGen,
  ObligationEngine,
  selectNext,
  rankCandidates,
  computeCost,
  DEFAULT_WEIGHTS,
  type ClarificationCandidate,
} from '../src/index.js'

function g() {
  return new RequirementGraph(deterministicIdGen())
}
function engine() {
  return new ObligationEngine({ idGen: deterministicIdGen('ob'), now: () => 1 })
}

function candidate(partial: Partial<ClarificationCandidate>): ClarificationCandidate {
  return {
    id: partial.id ?? 'c',
    targetNodeIds: partial.targetNodeIds ?? [],
    obligationIds: partial.obligationIds ?? [],
    question: partial.question ?? 'q',
    supportsFreeText: partial.supportsFreeText ?? false,
    supportsUnknown: partial.supportsUnknown ?? false,
    supportsDefer: partial.supportsDefer ?? false,
    supportsNoneOfAbove: partial.supportsNoneOfAbove ?? false,
    estimatedBenefit: partial.estimatedBenefit ?? 0,
    estimatedHumanCost: partial.estimatedHumanCost ?? 0,
    priorityReason: partial.priorityReason ?? '',
    eligibleState: partial.eligibleState ?? 'any',
    isHighImpactPolicy: partial.isHighImpactPolicy ?? false,
    choiceOptions: partial.choiceOptions,
  }
}

describe('selector: cost & benefit', () => {
  it('cost grows with options and free-text', () => {
    const base = computeCost(candidate({ id: 'a' }), DEFAULT_WEIGHTS)
    const withOpts = computeCost(candidate({ id: 'a', choiceOptions: ['x', 'y', 'z'] }), DEFAULT_WEIGHTS)
    const withFreeText = computeCost(candidate({ id: 'a', supportsFreeText: true }), DEFAULT_WEIGHTS)
    expect(withOpts).toBeGreaterThan(base)
    expect(withFreeText).toBeGreaterThan(base)
  })

  it('benefit counts open critical obligations addressed', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's' })
    const eng = engine()
    const o = eng.open({ nodeId: n.id, kind: 'policy_confirmation', description: 'policy' }) // critical
    const ranked = rankCandidates(
      [candidate({ id: 'c', targetNodeIds: [n.id], obligationIds: [o.id] })],
      graph,
      eng,
    )
    expect(ranked[0].benefit).toBeGreaterThan(0)
  })
})

describe('selector: min-risk gate for high-impact policy', () => {
  it('a high-impact policy candidate is never ranked below the gate even with low benefit', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's' })
    const eng = engine()
    // A high-impact policy question with NO open obligations (zero benefit) must still score >= gate.
    const policy = candidate({ id: 'policy', targetNodeIds: [n.id], isHighImpactPolicy: true })
    const plain = candidate({ id: 'plain', targetNodeIds: [n.id] })
    const ranked = rankCandidates([plain, policy], graph, eng)
    const policyScore = ranked.find((r) => r.candidate.id === 'policy')!
    expect(policyScore.score).toBeGreaterThanOrEqual(DEFAULT_WEIGHTS.minRiskGate)
    expect(policyScore.gated).toBe(true)
  })
})

describe('selector: budget stop', () => {
  it('selectNext returns null when the budget is exhausted (stopping, not passing)', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's' })
    const eng = engine()
    const o = eng.open({ nodeId: n.id, kind: 'policy_confirmation', description: 'policy' })
    const c = candidate({ id: 'c', targetNodeIds: [n.id], obligationIds: [o.id] })
    expect(selectNext([c], graph, eng, { budgetRemaining: 0 })).toBeNull()
    expect(selectNext([c], graph, eng, { budgetRemaining: -5 })).toBeNull()
    expect(selectNext([c], graph, eng, { budgetRemaining: 1 })?.candidate.id).toBe('c')
  })
})

describe('selector: ranking & eligibility', () => {
  it('ranks higher-benefit candidates first (stable tie-break by id)', () => {
    const graph = g()
    const a = graph.addNode({ nodeType: 'goal', title: 'A', description: 'd', scope: 's', criticality: 0.9 })
    const b = graph.addNode({ nodeType: 'goal', title: 'B', description: 'd', scope: 's', criticality: 0.1 })
    const eng = engine()
    const ranked = rankCandidates(
      [
        candidate({ id: 'low', targetNodeIds: [b.id] }),
        candidate({ id: 'high', targetNodeIds: [a.id] }),
      ],
      graph,
      eng,
    )
    expect(ranked[0].candidate.id).toBe('high')
  })

  it('excludes a candidate whose eligibleState does not match any target node status', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's', status: 'draft' })
    const eng = engine()
    const c = candidate({ id: 'c', targetNodeIds: [n.id], eligibleState: 'ready' })
    expect(rankCandidates([c], graph, eng)).toHaveLength(0)
    expect(selectNext([c], graph, eng)).toBeNull()
  })

  it('penalizes re-asks (a re-asked candidate ranks below a fresh equivalent)', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's' })
    const eng = engine()
    const o = eng.open({ nodeId: n.id, kind: 'policy_confirmation', description: 'policy' })
    const fresh = candidate({ id: 'fresh', targetNodeIds: [n.id], obligationIds: [o.id] })
    const reAsked = candidate({ id: 'reasked', targetNodeIds: [n.id], obligationIds: [o.id] })
    const ranked = rankCandidates([reAsked, fresh], graph, eng, { reAskCounts: { reasked: 3 } })
    expect(ranked[0].candidate.id).toBe('fresh')
  })

  it('produces explainable reasons for a prioritized candidate', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's' })
    const eng = engine()
    const o = eng.open({ nodeId: n.id, kind: 'policy_confirmation', description: 'policy' })
    const c = candidate({ id: 'c', targetNodeIds: [n.id], obligationIds: [o.id], isHighImpactPolicy: true })
    const top = selectNext([c], graph, eng)!
    expect(top.reasons.some((r) => /gate/i.test(r))).toBe(true)
  })
})
