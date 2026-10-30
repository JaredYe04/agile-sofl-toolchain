import { describe, expect, it } from 'vitest'
import {
  RequirementGraph,
  deterministicIdGen,
  ObligationEngine,
  DecisionStore,
  computeImpactSet,
  EventLog,
} from '../src/index.js'

function g() {
  return new RequirementGraph(deterministicIdGen())
}
function engine() {
  return new ObligationEngine({ idGen: deterministicIdGen('ob'), now: () => 1 })
}

describe('DecisionStore: provenance on record (anti-fabrication)', () => {
  it('records a real-user decision as user_confirmed', () => {
    const events = new EventLog()
    const store = new DecisionStore({ idGen: deterministicIdGen('dec'), now: () => 1, events })
    const d = store.record({ question: 'Window?', answer: '24h', actorKind: 'user', provenance: 'user_confirmed' })
    expect(d.provenance).toBe('user_confirmed')
    expect(d.status).toBe('recorded')
    expect(events.ofType('decision_recorded')).toHaveLength(1)
  })

  it('rejects a simulated user stamping user_confirmed (the hard invariant)', () => {
    const store = new DecisionStore({ idGen: deterministicIdGen('dec'), now: () => 1 })
    expect(() =>
      store.record({ question: 'q', answer: 'a', actorKind: 'simulated_user', provenance: 'user_confirmed' }),
    ).toThrowError()
  })

  it('rejects recording a decision stamped AI_hypothesis (an LLM guess is not a decision)', () => {
    const store = new DecisionStore({ idGen: deterministicIdGen('dec'), now: () => 1 })
    expect(() =>
      store.record({ question: 'q', answer: 'a', actorKind: 'user', provenance: 'AI_hypothesis' }),
    ).toThrowError(/AI_hypothesis/i)
  })

  it('accepts a simulated user answer (simulated_user_answer) as an interaction proxy', () => {
    const store = new DecisionStore({ idGen: deterministicIdGen('dec'), now: () => 1 })
    const d = store.record({ question: 'q', answer: 'a', actorKind: 'simulated_user', provenance: 'simulated_user_answer' })
    expect(d.provenance).toBe('simulated_user_answer')
  })

  it('requires a question and an answer', () => {
    const store = new DecisionStore({ idGen: deterministicIdGen('dec'), now: () => 1 })
    expect(() => store.record({ question: '', answer: 'a', actorKind: 'user', provenance: 'user_confirmed' })).toThrowError()
    expect(() => store.record({ question: 'q', answer: '', actorKind: 'user', provenance: 'user_confirmed' })).toThrowError()
  })
})

describe('DecisionStore: withdrawal + propagation (never silently re-approves)', () => {
  it('withdrawing a decision re-opens the obligations it discharged', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's' })
    const eng = engine()
    const o = eng.open({ nodeId: n.id, kind: 'policy_confirmation', description: 'policy' })
    const events = new EventLog()
    const store = new DecisionStore({ idGen: deterministicIdGen('dec'), now: () => 1, events, graph, engine: eng })
    const d = store.record({
      question: 'policy?',
      answer: 'yes',
      actorKind: 'user',
      provenance: 'user_confirmed',
      targetNodeIds: [n.id],
      obligationIds: [o.id],
    })
    eng.discharge(o.id, { kind: 'decision', decision: { decisionId: d.decisionId, actorKind: 'user', provenance: 'user_confirmed', answer: 'yes' } })
    expect(o.status).toBe('satisfied')

    const result = store.withdraw(d.decisionId)
    expect(o.status).toBe('open') // re-opened, NOT silently left satisfied
    expect(result.reopenedObligationIds).toContain(o.id)
    expect(events.ofType('decision_withdrawn')).toHaveLength(1)
    expect(events.ofType('propagation_invalidate')).toHaveLength(1)
  })

  it('withdrawing a confirmed decision pulls the grounded node back to needs_clarification', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's', status: 'ready' })
    const eng = engine()
    const events = new EventLog()
    const store = new DecisionStore({ idGen: deterministicIdGen('dec'), now: () => 1, events, graph, engine: eng })
    const d = store.record({
      question: 'confirm?',
      answer: 'yes',
      actorKind: 'user',
      provenance: 'user_confirmed',
      targetNodeIds: [n.id],
    })
    // The node is ready (grounded by the confirmed decision).
    expect(n.status).toBe('ready')
    const result = store.withdraw(d.decisionId)
    expect(n.status).toBe('needs_clarification') // demoted, never silently re-approved
    expect(result.nodeStatusChanges.some((c) => c.nodeId === n.id && c.from === 'ready' && c.to === 'needs_clarification')).toBe(true)
  })

  it('a simulated-user answer does NOT ground a node, so its withdrawal does not demote it', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's', status: 'ready' })
    const eng = engine()
    const store = new DecisionStore({ idGen: deterministicIdGen('dec'), now: () => 1, graph, engine: eng })
    const d = store.record({
      question: 'confirm?',
      answer: 'yes',
      actorKind: 'simulated_user',
      provenance: 'simulated_user_answer',
      targetNodeIds: [n.id],
    })
    const result = store.withdraw(d.decisionId)
    // A simulated answer is an interaction proxy, not real confirmation -> node stays ready.
    expect(n.status).toBe('ready')
    expect(result.nodeStatusChanges).toHaveLength(0)
  })

  it('supersede: recording a decision that supersedes another withdraws the old one', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's' })
    const eng = engine()
    const o = eng.open({ nodeId: n.id, kind: 'policy_confirmation', description: 'policy' })
    const store = new DecisionStore({ idGen: deterministicIdGen('dec'), now: () => 1, graph, engine: eng })
    const old = store.record({
      question: 'policy?',
      answer: 'allow',
      actorKind: 'user',
      provenance: 'user_confirmed',
      targetNodeIds: [n.id],
      obligationIds: [o.id],
    })
    eng.discharge(o.id, { kind: 'decision', decision: { decisionId: old.decisionId, actorKind: 'user', provenance: 'user_confirmed', answer: 'allow' } })
    const fresh = store.record({
      question: 'policy?',
      answer: 'deny',
      actorKind: 'user',
      provenance: 'user_confirmed',
      targetNodeIds: [n.id],
      obligationIds: [o.id],
      supersedes: old.decisionId,
    })
    expect(old.status).toBe('withdrawn')
    expect(o.status).toBe('open') // re-opened by the supersession
    expect(fresh.status).toBe('recorded')
    void fresh
  })

  it('withdraw is idempotent (withdrawing twice has no further effect)', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's' })
    const eng = engine()
    const store = new DecisionStore({ idGen: deterministicIdGen('dec'), now: () => 1, graph, engine: eng })
    const d = store.record({ question: 'q', answer: 'a', actorKind: 'user', provenance: 'user_confirmed', targetNodeIds: [n.id] })
    store.withdraw(d.decisionId)
    const second = store.withdraw(d.decisionId)
    expect(second.withdrawnDecisionIds).toHaveLength(0)
  })
})

describe('computeImpactSet', () => {
  it('includes the seed, its refines descendants, and downstream dependents transitively', () => {
    const graph = g()
    const root = graph.addNode({ nodeType: 'goal', title: 'R', description: 'd', scope: 's' })
    const a = graph.addNode({ nodeType: 'feature', title: 'A', description: 'd', scope: 's', parentId: root.id })
    // b depends on a (downstream of a).
    const b = graph.addNode({ nodeType: 'process_ref', title: 'B', description: 'd', scope: 's' })
    graph.addEdge({ source: b.id, target: a.id, kind: 'depends_on' })
    const impact = computeImpactSet(graph, [a.id])
    expect(impact).toContain(a.id)
    expect(impact).toContain(b.id) // b depends on a
  })

  it('follows constrains from the seed to its targets', () => {
    const graph = g()
    const c = graph.addNode({ nodeType: 'constraint', title: 'C', description: 'd', scope: 's' })
    const p = graph.addNode({ nodeType: 'process_ref', title: 'P', description: 'd', scope: 's' })
    graph.addEdge({ source: c.id, target: p.id, kind: 'constrains' })
    const impact = computeImpactSet(graph, [c.id])
    expect(impact).toContain(p.id)
  })

  it('drops dangling seeds', () => {
    const graph = g()
    graph.addNode({ nodeType: 'goal', title: 'R', description: 'd', scope: 's' })
    expect(computeImpactSet(graph, ['ghost'])).toHaveLength(0)
  })
})

describe('decision events feed the log (traceable record)', () => {
  it('records decision_recorded with the decision id', () => {
    const events = new EventLog()
    const store = new DecisionStore({ idGen: deterministicIdGen('dec'), now: () => 1, events })
    store.record({ question: 'q', answer: 'a', actorKind: 'user', provenance: 'user_confirmed' })
    const ev = events.all()[0]
    expect(ev.event.type).toBe('decision_recorded')
    if (ev.event.type === 'decision_recorded') {
      expect(ev.event.decisionId).toBe('dec_d1')
    }
  })
})
