import { describe, expect, it } from 'vitest'
import {
  RequirementGraph,
  deterministicIdGen,
  ObligationEngine,
  DecisionStore,
  ReadinessAssessor,
  EventLog,
  selectNext,
  toDocument,
  fromDocument,
  type ClarificationCandidate,
} from '../src/index.js'

const NOW = () => 1
function mk() {
  const graph = new RequirementGraph(deterministicIdGen())
  const engine = new ObligationEngine({ idGen: deterministicIdGen('ob'), now: NOW })
  const events = new EventLog(NOW)
  // The store emits its decision/propagation events into the shared log (so replay + the
  // propagation_invalidate assertion in scenario 1 observe the full record).
  const store = new DecisionStore({ idGen: deterministicIdGen('dec'), now: NOW, graph, engine, events })
  return { graph, engine, store, events }
}
const assessor = new ReadinessAssessor(deterministicIdGen())

function cand(p: Partial<ClarificationCandidate>): ClarificationCandidate {
  return {
    id: p.id ?? 'c',
    targetNodeIds: p.targetNodeIds ?? [],
    obligationIds: p.obligationIds ?? [],
    question: p.question ?? 'q',
    supportsFreeText: p.supportsFreeText ?? true,
    supportsUnknown: p.supportsUnknown ?? true,
    supportsDefer: p.supportsDefer ?? true,
    supportsNoneOfAbove: p.supportsNoneOfAbove ?? false,
    estimatedBenefit: 0,
    estimatedHumanCost: 0,
    priorityReason: '',
    eligibleState: p.eligibleState ?? 'any',
    isHighImpactPolicy: p.isHighImpactPolicy ?? false,
  }
}

describe('integration scenario 1: booking cancellation (defer + withdrawal propagation)', () => {
  it('defers the cancellation window, then a withdrawal re-opens dependents (never re-approves)', () => {
    const { graph, engine, store, events } = mk()
    // Goal -> refund window (a policy that needs confirming).
    const goal = graph.addNode({ nodeType: 'system_goal', title: 'Cancel booking', description: 'd', scope: 'booking' })
    // The pending clarification is carried by the (critical) policy obligation below, not by a forced
    // node status — so that after the stakeholder defers it, the verdict is DEFERRED, not shadowed by a
    // needs_clarification node (that path is covered separately in readiness.test.ts).
    const window = graph.addNode({ nodeType: 'goal', title: 'Cancellation window', description: 'd', scope: 'booking', parentId: goal.id, criticality: 0.9 })
    const refund = graph.addNode({ nodeType: 'feature', title: 'Refund', description: 'd', scope: 'booking', parentId: window.id })
    void refund

    // Open a critical policy obligation on the window.
    const policy = engine.open({ nodeId: window.id, kind: 'policy_confirmation', description: 'confirm cancellation window (high-impact)' })

    // Not ready while the policy is open.
    expect(assessor.assess({ graph, engine, decisions: store, scope: { scope: 'booking', targetStage: 'impl' } }).verdict).toBe('NEEDS_CLARIFICATION')

    // The selector offers the (gated) policy question as the next clarification.
    const next = selectNext([cand({ id: 'q1', targetNodeIds: [window.id], obligationIds: [policy.id], isHighImpactPolicy: true, question: 'What is the cancellation window?' })], graph, engine)
    expect(next?.candidate.id).toBe('q1')
    expect(next?.gated).toBe(true)

    // Stakeholder does not know yet -> DEFER (tracked, not approved).
    const decision = store.record({
      question: 'What is the cancellation window?',
      answer: 'unknown, will confirm later',
      actorKind: 'user',
      provenance: 'deferred',
      targetNodeIds: [window.id],
      obligationIds: [policy.id],
    })
    engine.defer(policy.id, 'stakeholder unsure')
    expect(policy.status).toBe('deferred')
    // Deferred is not a pass.
    expect(assessor.assess({ graph, engine, decisions: store, scope: { scope: 'booking', targetStage: 'impl' } }).verdict).toBe('DEFERRED')

    // The stakeholder withdraws the rule -> the obligation re-opens (not silently re-approved).
    const result = store.withdraw(decision.decisionId)
    expect(policy.status).toBe('open')
    expect(result.reopenedObligationIds).toContain(policy.id)
    expect(events.ofType('propagation_invalidate').length).toBeGreaterThanOrEqual(1)
    // Back to NEEDS_CLARIFICATION.
    expect(assessor.assess({ graph, engine, decisions: store, scope: { scope: 'booking', targetStage: 'impl' } }).verdict).toBe('NEEDS_CLARIFICATION')
  })
})

describe('integration scenario 2: order/refund cross-process consistency + branch conflict', () => {
  it('constrains links two processes; a conflicting refund policy needs a user decision', () => {
    const { graph, engine, store } = mk()
    const inv = graph.addNode({ nodeType: 'process_ref', title: 'Inventory', description: 'd', scope: 'order' })
    const order = graph.addNode({ nodeType: 'process_ref', title: 'Order', description: 'd', scope: 'order' })
    // A consistency constraint constrains both processes (many-to-many).
    const cons = graph.addNode({ nodeType: 'constraint', title: 'inventory/order consistency', description: 'd', scope: 'order' })
    graph.addEdge({ source: cons.id, target: inv.id, kind: 'constrains' })
    graph.addEdge({ source: cons.id, target: order.id, kind: 'constrains' })

    // A conflicting refund policy -> conflicts_with.
    const refundA = graph.addNode({ nodeType: 'constraint', title: 'refund-allow', description: 'd', scope: 'order' })
    const refundB = graph.addNode({ nodeType: 'constraint', title: 'refund-deny', description: 'd', scope: 'order' })
    graph.addEdge({ source: refundA.id, target: refundB.id, kind: 'conflicts_with', evidence: 'branch conflict' })

    // The mechanical detector opens a critical conflict obligation.
    engine.detect(graph)
    const conflict = engine.openCritical().find((o) => o.kind === 'cross_process_dependency_conflict')
    expect(conflict).toBeDefined()

    // A branch conflict is a hard stop: a simulated user cannot LAUNDER its answer into a confirmed
    // decision (there is no simulated_user -> user_confirmed path). A correctly-labeled simulated
    // answer (simulated_user_answer) would be a legitimate proxy discharge, so the illegal pairing is what we assert.
    expect(() =>
      engine.discharge(conflict!.id, { kind: 'decision', decision: { decisionId: 'x', actorKind: 'simulated_user', provenance: 'user_confirmed', answer: 'allow' } }),
    ).toThrowError()
    // A real authorized decider resolves the trade-off.
    const d = store.record({
      question: 'Allow or deny refund on conflict?',
      answer: 'allow within window, deny after',
      actorKind: 'authorized_decider',
      provenance: 'analyst_approved',
      targetNodeIds: [refundA.id, refundB.id],
      obligationIds: [conflict!.id],
    })
    engine.discharge(conflict!.id, { kind: 'decision', decision: { decisionId: d.decisionId, actorKind: 'authorized_decider', provenance: 'analyst_approved', answer: 'allow within window' } })
    expect(conflict!.status).toBe('satisfied')
    // No more critical conflicts => not NEEDS_CLARIFICATION on that front.
    expect(engine.openCritical().find((o) => o.kind === 'cross_process_dependency_conflict')).toBeUndefined()
  })
})

describe('integration scenario 3: permission change (defaulted allow/deny is AI_hypothesis, not confirmed)', () => {
  it('a defaulted role_permission stays AI_hypothesis until an authorized actor confirms', () => {
    const { graph, engine, store } = mk()
    const p1 = graph.addNode({ nodeType: 'process_ref', title: 'Process A', description: 'd', scope: 'perm' })
    const p2 = graph.addNode({ nodeType: 'process_ref', title: 'Process B', description: 'd', scope: 'perm' })
    // A role_permission obligation on each (user_decision).
    const o1 = engine.open({ nodeId: p1.id, kind: 'role_permission', description: 'defaulted allow for role A' })
    const o2 = engine.open({ nodeId: p2.id, kind: 'role_permission', description: 'defaulted deny for role B' })
    expect(o1.detectorClass).toBe('user_decision')
    expect(o1.policyRequired).toBe(true)

    // A version-conflict proposal: two actors propose different scopes. A simulated user cannot
    // launder its answer into a confirmed decision (no simulated_user -> user_confirmed path).
    expect(() =>
      engine.discharge(o1.id, { kind: 'decision', decision: { decisionId: 'x', actorKind: 'simulated_user', provenance: 'user_confirmed', answer: 'allow all' } }),
    ).toThrowError()
    // The default stays an AI_hypothesis: it is NOT stamped confirmed.
    expect(p1.source).toBe('AI_hypothesis')

    // A real authorized decider confirms the scope.
    const d = store.record({ question: 'Role A scope?', answer: 'read only', actorKind: 'authorized_decider', provenance: 'analyst_approved', targetNodeIds: [p1.id], obligationIds: [o1.id] })
    engine.discharge(o1.id, { kind: 'decision', decision: { decisionId: d.decisionId, actorKind: 'authorized_decider', provenance: 'analyst_approved', answer: 'read only' } })
    expect(o1.status).toBe('satisfied')
    // The other process's obligation is still open (independent scope).
    expect(o2.status).toBe('open')
  })
})

describe('integration: full vertical slice survives persist/close/reopen', () => {
  it('IDs, relations, decisions, and obligations survive a save/load round-trip', () => {
    const { graph, engine, store } = mk()
    const root = graph.addNode({ nodeType: 'system_goal', title: 'Goal', description: 'd', scope: 's' })
    const child = graph.addNode({ nodeType: 'goal', title: 'Sub', description: 'd', scope: 's', parentId: root.id })
    const o = engine.open({ nodeId: child.id, kind: 'policy_confirmation', description: 'policy' })
    const d = store.record({ question: 'q', answer: 'a', actorKind: 'user', provenance: 'user_confirmed', targetNodeIds: [child.id], obligationIds: [o.id] })
    engine.discharge(o.id, { kind: 'decision', decision: { decisionId: d.decisionId, actorKind: 'user', provenance: 'user_confirmed', answer: 'a' } })

    const doc = toDocument({ graph, obligations: engine.all(), decisions: store.all(), events: new EventLog(NOW) }, { docVersion: 3, now: NOW })
    const loaded = fromDocument(doc, { idGen: deterministicIdGen(), expectedDocVersion: 3 })

    // Identity + topology survive.
    expect(loaded.graph.getNode(root.id)).toBeDefined()
    expect(loaded.graph.getNode(child.id)?.parentId).toBe(root.id)
    // Obligation survives (discharged).
    const lo = loaded.obligations.find((x) => x.nodeId === child.id)
    expect(lo?.status).toBe('satisfied')
    // Decision survives with its provenance.
    expect(loaded.decisions.find((x) => x.decisionId === d.decisionId)?.provenance).toBe('user_confirmed')
  })
})
