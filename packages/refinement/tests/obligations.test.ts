import { describe, expect, it } from 'vitest'
import { RequirementGraph, deterministicIdGen, ObligationEngine } from '../src/index.js'

function g() {
  return new RequirementGraph(deterministicIdGen())
}
function engine() {
  return new ObligationEngine({ idGen: deterministicIdGen('ob'), now: () => 1 })
}

describe('ObligationEngine: open & query', () => {
  it('opens an obligation with defaults from the kind table', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'process_ref', title: 'P', description: 'd', scope: 's' })
    const e = engine()
    const o = e.open({ nodeId: n.id, kind: 'failure_path', description: 'no failure path' })
    expect(o.detectorClass).toBe('llm_candidate')
    expect(o.severity).toBe('major')
    expect(o.status).toBe('open')
    expect(o.policyRequired).toBe(false)
  })

  it('marks policy_confirmation and role_permission as policy-required', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's' })
    const e = engine()
    expect(e.open({ nodeId: n.id, kind: 'policy_confirmation', description: 'x' }).policyRequired).toBe(true)
    expect(e.open({ nodeId: n.id, kind: 'role_permission', description: 'x' }).policyRequired).toBe(true)
  })
})

describe('ObligationEngine: mechanical detection (deterministic, no LLM)', () => {
  it('opens acceptance_scenario for an atomic process with no scenario, and closes it when one is added', () => {
    const graph = g()
    const p = graph.addNode({ nodeType: 'process_ref', title: 'P', description: 'd', scope: 's' })
    const e = engine()
    const first = e.detect(graph)
    expect(first.opened.map((o) => o.kind)).toContain('acceptance_scenario')

    // Add an acceptance scenario child -> the detector should auto-discharge on re-run.
    graph.addNode({ nodeType: 'acceptance_scenario', title: 'S', description: 'd', scope: 's', parentId: p.id })
    const second = e.detect(graph)
    expect(second.discharged.map((o) => o.kind)).toContain('acceptance_scenario')
    expect(e.byNode(p.id).find((o) => o.kind === 'acceptance_scenario')?.status).toBe('satisfied')
  })

  it('is idempotent: a second detect on an unchanged graph opens nothing new', () => {
    const graph = g()
    graph.addNode({ nodeType: 'process_ref', title: 'P', description: 'd', scope: 's' })
    const e = engine()
    e.detect(graph)
    const second = e.detect(graph)
    expect(second.opened).toHaveLength(0)
  })

  it('opens data_state_update for an unbound data requirement and closes it when bound', () => {
    const graph = g()
    const d = graph.addNode({ nodeType: 'data_ref', title: 'D', description: 'd', scope: 's' })
    const e = engine()
    expect(e.detect(graph).opened.map((o) => o.kind)).toContain('data_state_update')
    // Bind to a concrete artifact.
    d.artifactRefs.push({ refKind: 'hybrid_type', refId: 'T' })
    expect(e.detect(graph).discharged.map((o) => o.kind)).toContain('data_state_update')
    expect(e.byNode(d.id).find((o) => o.kind === 'data_state_update')?.status).toBe('satisfied')
  })

  it('opens cross_process_dependency_conflict for a conflicts_with link (critical)', () => {
    const graph = g()
    const a = graph.addNode({ nodeType: 'constraint', title: 'A', description: 'd', scope: 's' })
    const b = graph.addNode({ nodeType: 'constraint', title: 'B', description: 'd', scope: 's' })
    graph.addEdge({ source: a.id, target: b.id, kind: 'conflicts_with' })
    const e = engine()
    const r = e.detect(graph)
    const conflict = r.opened.find((o) => o.kind === 'cross_process_dependency_conflict')
    expect(conflict).toBeDefined()
    expect(conflict?.severity).toBe('critical')
  })

  it('opens an unmet depends_on (target blocked) as a dependency conflict', () => {
    const graph = g()
    const a = graph.addNode({ nodeType: 'process_ref', title: 'A', description: 'd', scope: 's' })
    const b = graph.addNode({ nodeType: 'process_ref', title: 'B', description: 'd', scope: 's', status: 'blocked' })
    graph.addEdge({ source: a.id, target: b.id, kind: 'depends_on' })
    const e = engine()
    expect(e.detect(graph).opened.map((o) => o.kind)).toContain('cross_process_dependency_conflict')
  })
})

describe('ObligationEngine: detector-class discharge rules (anti-fabrication)', () => {
  it('a mechanical obligation can be auto-discharged by the checker', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'data_ref', title: 'D', description: 'd', scope: 's' })
    const e = engine()
    const o = e.detect(graph).opened[0] // data_state_update, mechanical
    e.discharge(o.id, { kind: 'checker' })
    expect(o.status).toBe('satisfied')
  })

  it('a mechanical obligation CANNOT be closed by an AI_hypothesis guess', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'data_ref', title: 'D', description: 'd', scope: 's' })
    const e = engine()
    const o = e.detect(graph).opened[0]
    expect(() =>
      e.discharge(o.id, { kind: 'decision', decision: { decisionId: 'x', actorKind: 'simulated_user', provenance: 'AI_hypothesis', answer: 'guess' } }),
    ).toThrowError(/AI_hypothesis/i)
  })

  it('an llm_candidate CANNOT be auto-discharged by the checker', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'process_ref', title: 'P', description: 'd', scope: 's' })
    const e = engine()
    const o = e.open({ nodeId: n.id, kind: 'failure_path', description: 'no failure path' })
    expect(() => e.discharge(o.id, { kind: 'checker' })).toThrowError(/checker/i)
  })

  it('an llm_candidate CAN be closed by a confirmed decision', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'process_ref', title: 'P', description: 'd', scope: 's' })
    const e = engine()
    const o = e.open({ nodeId: n.id, kind: 'failure_path', description: 'no failure path' })
    e.discharge(o.id, { kind: 'decision', decision: { decisionId: 'x', actorKind: 'user', provenance: 'user_confirmed', answer: 'timeout -> retry' } })
    expect(o.status).toBe('satisfied')
  })

  it('a user_decision (policy) CAN be discharged by a correctly-labeled simulated stakeholder (the experiment stand-in)', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's' })
    const e = engine()
    const o = e.open({ nodeId: n.id, kind: 'policy_confirmation', description: 'high-impact policy' })
    expect(o.detectorClass).toBe('user_decision')
    // A correctly-labeled simulated answer (simulated_user + simulated_user_answer) is a legitimate
    // discharge in the experiment — it is an interaction proxy, never a real confirmation.
    e.discharge(o.id, { kind: 'decision', decision: { decisionId: 'x', actorKind: 'simulated_user', provenance: 'simulated_user_answer', answer: 'ok' } })
    expect(o.status).toBe('satisfied')
  })

  it('a simulated user CANNOT launder a guess into user_confirmed (the hard anti-fabrication invariant)', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's' })
    const e = engine()
    const o = e.open({ nodeId: n.id, kind: 'policy_confirmation', description: 'high-impact policy' })
    expect(o.detectorClass).toBe('user_decision')
    // There is NO code path from a simulated user to user_confirmed: the actor/provenance pairing is illegal.
    expect(() =>
      e.discharge(o.id, { kind: 'decision', decision: { decisionId: 'x', actorKind: 'simulated_user', provenance: 'user_confirmed', answer: 'confirmed' } }),
    ).toThrowError(/user_confirmed|may not discharge/i)
    expect(o.status).toBe('open') // unchanged — nothing was laundered
  })

  it('a waiver requires a justification (explicit risk acceptance)', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's' })
    const e = engine()
    const o = e.open({ nodeId: n.id, kind: 'policy_confirmation', description: 'policy' })
    expect(() => e.discharge(o.id, { kind: 'waive', justification: '' })).toThrowError(/justification/i)
    e.discharge(o.id, { kind: 'waive', justification: 'accepted risk, revisit in v2' })
    expect(o.status).toBe('waived')
  })

  it('defer is tracked and reversible (not a silent approval)', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's' })
    const e = engine()
    const o = e.open({ nodeId: n.id, kind: 'policy_confirmation', description: 'policy' })
    e.defer(o.id, 'waiting on legal')
    expect(o.status).toBe('deferred')
    e.reopen(o.id, 'legal responded')
    expect(o.status).toBe('open')
  })

  it('an ingested external diagnostic is mechanical and not auto-closed by the graph detector', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'process_ref', title: 'P', description: 'd', scope: 's' })
    const e = engine()
    const o = e.ingestExternal({
      nodeId: n.id,
      kind: 'precondition_input_constraint',
      description: 'FSF missing others',
      checkerOrigin: 'ASFL_FSF_003',
    })
    expect(o.detectorClass).toBe('mechanical')
    expect(o.checkerOrigin).toBe('ASFL_FSF_003')
    // A graph detect() must NOT auto-discharge it (it is not a graph-detected kind).
    e.detect(graph)
    expect(o.status).toBe('open')
  })
})
