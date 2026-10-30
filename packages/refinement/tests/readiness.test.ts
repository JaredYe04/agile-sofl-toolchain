import { describe, expect, it } from 'vitest'
import {
  RequirementGraph,
  deterministicIdGen,
  ObligationEngine,
  DecisionStore,
  ReadinessAssessor,
} from '../src/index.js'

function g() {
  return new RequirementGraph(deterministicIdGen())
}
function engine() {
  return new ObligationEngine({ idGen: deterministicIdGen('ob'), now: () => 1 })
}
function store() {
  return new DecisionStore({ idGen: deterministicIdGen('dec'), now: () => 1 })
}
const assessor = new ReadinessAssessor(deterministicIdGen())

describe('ReadinessAssessor: verdicts', () => {
  it('READY when no open critical obligations and no blocking diagnostics', () => {
    const graph = g()
    graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's', status: 'ready' })
    const a = assessor.assess({ graph, engine: engine(), decisions: store(), scope: { scope: 's', targetStage: 'impl' } })
    expect(a.verdict).toBe('READY')
  })

  it('NEEDS_CLARIFICATION when a critical obligation is open', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's' })
    const eng = engine()
    eng.open({ nodeId: n.id, kind: 'policy_confirmation', description: 'policy' }) // critical
    const a = assessor.assess({ graph, engine: eng, decisions: store(), scope: { scope: 's', targetStage: 'impl' } })
    expect(a.verdict).toBe('NEEDS_CLARIFICATION')
    expect(a.unresolvedCriticalObligations).toHaveLength(1)
  })

  it('NEEDS_CLARIFICATION when a node is in needs_clarification', () => {
    const graph = g()
    graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's', status: 'needs_clarification' })
    const a = assessor.assess({ graph, engine: engine(), decisions: store(), scope: { scope: 's', targetStage: 'impl' } })
    expect(a.verdict).toBe('NEEDS_CLARIFICATION')
  })

  it('BLOCKED on a graph invariant violation', () => {
    const graph = g()
    // Force a dangling edge: add an edge to a non-existent node is impossible via addEdge, so
    // construct a corrupt graph via fromPlain.
    const corrupt = RequirementGraph.fromPlain(
      {
        nodes: [{ id: 'n1', nodeType: 'goal', title: 'x', description: 'd', scope: 's', ordering: 0, version: 1, source: 'AI_hypothesis', status: 'draft', criticality: 0.5, artifactRefs: [] }],
        edges: [{ id: 'e1', source: 'n1', target: 'missing', kind: 'refines', version: 1 }],
      },
      deterministicIdGen(),
    )
    const a = assessor.assess({ graph: corrupt, engine: engine(), decisions: store(), scope: { scope: 's', targetStage: 'impl' } })
    expect(a.verdict).toBe('BLOCKED')
    expect(a.checkerDiagnostics.length).toBeGreaterThan(0)
  })

  it('BLOCKED when a node is in blocked status', () => {
    const graph = g()
    graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's', status: 'blocked' })
    const a = assessor.assess({ graph, engine: engine(), decisions: store(), scope: { scope: 's', targetStage: 'impl' } })
    expect(a.verdict).toBe('BLOCKED')
  })

  it('DEFERRED when critical resolved but an obligation is deferred', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's', status: 'ready' })
    const eng = engine()
    const o = eng.open({ nodeId: n.id, kind: 'failure_path', description: 'fp', severity: 'major' })
    eng.defer(o.id, 'later')
    const a = assessor.assess({ graph, engine: eng, decisions: store(), scope: { scope: 's', targetStage: 'impl' } })
    expect(a.verdict).toBe('DEFERRED')
    expect(a.deferredObligations).toContain(o.id)
  })
})

describe('ReadinessAssessor: budget is a stop, not a pass', () => {
  it('budget exhausted + not ready => INCOMPLETE_WITH_RISK (never READY)', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's' })
    const eng = engine()
    eng.open({ nodeId: n.id, kind: 'policy_confirmation', description: 'policy' }) // critical -> not ready
    const a = assessor.assess({
      graph,
      engine: eng,
      decisions: store(),
      scope: { scope: 's', targetStage: 'impl', budgetRemaining: 0 },
    })
    expect(a.verdict).toBe('INCOMPLETE_WITH_RISK')
    expect(/budget/i.test(a.reason)).toBe(true)
  })

  it('budget exhausted but genuinely ready => still READY (stop coincides with done)', () => {
    const graph = g()
    graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's', status: 'ready' })
    const a = assessor.assess({
      graph,
      engine: engine(),
      decisions: store(),
      scope: { scope: 's', targetStage: 'impl', budgetRemaining: 0 },
    })
    expect(a.verdict).toBe('READY')
  })

  it('budget exhausted never masks BLOCKED', () => {
    const graph = g()
    graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's', status: 'blocked' })
    const a = assessor.assess({
      graph,
      engine: engine(),
      decisions: store(),
      scope: { scope: 's', targetStage: 'impl', budgetRemaining: 0 },
    })
    expect(a.verdict).toBe('BLOCKED')
  })
})

describe('ReadinessAssessor: scoping', () => {
  it('scopes to the given node ids (ignores obligations outside scope)', () => {
    const graph = g()
    const inScope = graph.addNode({ nodeType: 'goal', title: 'In', description: 'd', scope: 's', status: 'ready' })
    const outOfScope = graph.addNode({ nodeType: 'goal', title: 'Out', description: 'd', scope: 's' })
    const eng = engine()
    eng.open({ nodeId: outOfScope.id, kind: 'policy_confirmation', description: 'policy' }) // critical but out of scope
    const a = assessor.assess({
      graph,
      engine: eng,
      decisions: store(),
      scope: { scope: 's', targetStage: 'impl', nodeIds: [inScope.id] },
    })
    expect(a.verdict).toBe('READY')
    expect(a.unresolvedCriticalObligations).toHaveLength(0)
  })
})
