import { describe, expect, it } from 'vitest'
import { RefinementSession, deterministicIdGen } from '../src/index.js'

/**
 * P4 GATE — the six replay tests required by task book §6.6 (the requirement-layer subset; the 7th,
 * "real .asfl fixtures still pass the language checks", lives in the studio/parser layer and is
 * exercised in P5/P6). Each scenario:
 *   (a) asserts the specific required behavior, and
 *   (b) is a REPLAY test — run twice with the same deterministic id generators + clock, the two runs
 *       must produce identical ids / verdicts (the §6.6 / P3 replay invariant).
 *
 * `RefinementSession` is the single headless domain-tool layer (task book §6.1 — NOT a second agent
 * system): propose structure (AI_hypothesis candidates), cost-aware clarification selection, isolated
 * actor decision recording (anti-fabrication), version-gated revision, and readiness. The Studio agent
 * later consumes it as thin tools.
 */

const NOW = () => 1

/** A fresh deterministic session (fresh id counters) — identical op order => identical ids/verdicts. */
function mkSession(): RefinementSession {
  return new RefinementSession({
    idGen: deterministicIdGen('rn'),
    obligationIdGen: deterministicIdGen('ob'),
    decisionIdGen: deterministicIdGen('dec'),
    readinessIdGen: deterministicIdGen('rdy'),
    now: NOW,
  })
}

/** Run a scenario twice and prove the two runs are byte-identical (replay determinism). */
function replay<T>(scenario: () => T): [T, T] {
  const a = scenario()
  const b = scenario()
  return [a, b]
}

// ---- Gate 1: coarse req -> candidate structure -> user confirm -> multi-round refine -> ready ----

function gate1() {
  const s = mkSession()
  const root = s.graph.addNode({ nodeType: 'system_goal', title: 'Reserve a seat', description: 'd', scope: 'booking' })
  const [capA, capB] = s.proposeRefinement(root.id, [
    { nodeType: 'capability', title: 'Seat availability', description: 'd' },
    { nodeType: 'capability', title: 'Seat role policy', description: 'd' },
  ])
  // Candidates are unconfirmed LLM hypotheses, never user_confirmed.
  expect(s.graph.getNode(capA)?.source).toBe('AI_hypothesis')
  expect(s.graph.getNode(capA)?.status).toBe('draft')
  // The LLM raises candidate alerts (a policy rule + a role policy) that need confirming.
  const oA = s.engine.open({ nodeId: capA, kind: 'policy_confirmation', description: 'confirm availability rule' })
  const oB = s.engine.open({ nodeId: capB, kind: 'role_permission', description: 'confirm seat role policy' })
  // Round 1: confirm the highest-priority (cost-aware) clarification.
  const r1 = s.selectNextClarification()
  expect(r1).not.toBeNull()
  s.recordDecision({ obligationId: r1!.obligationId, answer: { kind: 'confirm', answer: 'ok' }, actorKind: 'user' })
  // Round 2: a DIFFERENT obligation is offered (never re-asked the first).
  const r2 = s.selectNextClarification()
  expect(r2).not.toBeNull()
  expect(r2!.obligationId).not.toBe(r1!.obligationId)
  s.recordDecision({ obligationId: r2!.obligationId, answer: { kind: 'confirm', answer: 'ok' }, actorKind: 'user' })
  // Both candidates are now confirmed by a real user.
  expect(s.graph.getNode(capA)?.source).toBe('user_confirmed')
  expect(s.graph.getNode(capB)?.source).toBe('user_confirmed')
  expect(s.engine.get(oA.id)?.status).toBe('satisfied')
  expect(s.engine.get(oB.id)?.status).toBe('satisfied')
  const verdict = s.assessReadiness('booking', 'impl').verdict
  expect(verdict).toBe('READY')
  return { capA, capB, oA: oA.id, oB: oB.id, first: r1!.obligationId, second: r2!.obligationId, verdict }
}

it('gate 1: coarse -> confirm -> multi-round refine -> ready (replay-deterministic)', () => {
  const [a, b] = replay(gate1)
  expect(b).toEqual(a)
})

// ---- Gate 2: user selects `unknown` -> the system does NOT fabricate a rule ------------------------

function gate2() {
  const s = mkSession()
  const root = s.graph.addNode({ nodeType: 'system_goal', title: 'Approve refund', description: 'd', scope: 'refund' })
  const [cap] = s.proposeRefinement(root.id, [{ nodeType: 'capability', title: 'Refund rule', description: 'd' }])
  const o = s.engine.open({ nodeId: cap, kind: 'policy_confirmation', description: 'confirm refund window policy' })
  // The stakeholder does not know the answer.
  const eff = s.recordDecision({ obligationId: o.id, answer: { kind: 'unknown' }, actorKind: 'user' })
  // NO fabrication: the obligation stays open, the node is NOT promoted or stamped confirmed.
  expect(s.engine.get(o.id)?.status).toBe('open')
  expect(s.graph.getNode(cap)?.source).toBe('AI_hypothesis')
  expect(s.graph.getNode(cap)?.status).toBe('draft')
  expect(eff.dischargedObligationIds).toEqual([])
  expect(eff.promotedNodeIds).toEqual([])
  expect(eff.fabricated).toBe(false)
  // Risk is preserved: the scope is NOT ready.
  const verdict = s.assessReadiness('refund', 'impl').verdict
  expect(verdict).toBe('NEEDS_CLARIFICATION')
  // ...and the same decision is not re-asked (it was answered `unknown`, which is a recorded answer).
  expect(s.selectNextClarification()).toBeNull()
  return { o: o.id, status: s.engine.get(o.id)?.status, source: s.graph.getNode(cap)?.source, verdict, reAsk: s.selectNextClarification() }
}

it('gate 2: `unknown` does not fabricate a rule (replay-deterministic)', () => {
  const [a, b] = replay(gate2)
  expect(b).toEqual(a)
})

// ---- Gate 3: user selects `defer` -> risk preserved, non-blocking branches continue ----------------

function gate3() {
  const s = mkSession()
  const root = s.graph.addNode({ nodeType: 'system_goal', title: 'Deliver order', description: 'd', scope: 'delivery' })
  const [pay, window] = s.proposeRefinement(root.id, [
    { nodeType: 'capability', title: 'Payment policy', description: 'd' },
    { nodeType: 'capability', title: 'Delivery window', description: 'd' },
  ])
  const oWindow = s.engine.open({ nodeId: window, kind: 'boundary_condition', description: 'confirm delivery window bounds' })
  const oPay = s.engine.open({ nodeId: pay, kind: 'policy_confirmation', description: 'confirm payment policy' })
  // The stakeholder defers the delivery-window obligation (a "come back later", not a pass).
  const eff = s.recordDecision({ obligationId: oWindow.id, answer: { kind: 'defer' }, actorKind: 'user' })
  expect(s.engine.get(oWindow.id)?.status).toBe('deferred')
  expect(eff.deferredObligationIds).toContain(oWindow.id)
  expect(eff.dischargedObligationIds).toEqual([])
  expect(s.graph.getNode(window)?.status).toBe('deferred')
  // A non-blocking branch (the payment policy) is still selectable and can proceed.
  const next = s.selectNextClarification()
  expect(next?.obligationId).toBe(oPay.id)
  s.recordDecision({ obligationId: oPay.id, answer: { kind: 'confirm', answer: 'ok' }, actorKind: 'user' })
  // Verdict is DEFERRED (risk tracked, not approved) — NOT ready, and NOT blocked.
  const verdict = s.assessReadiness('delivery', 'impl').verdict
  expect(verdict).toBe('DEFERRED')
  expect(s.graph.getNode(pay)?.status).toBe('ready')
  expect(s.graph.getNode(window)?.status).toBe('deferred')
  return { oWindow: oWindow.id, oPay: oPay.id, verdict, windowStatus: s.graph.getNode(window)?.status, payStatus: s.graph.getNode(pay)?.status }
}

it('gate 3: `defer` preserves risk and lets non-blocking branches continue (replay-deterministic)', () => {
  const [a, b] = replay(gate3)
  expect(b).toEqual(a)
})

// ---- Gate 4: user modifies a prior rule -> dependents invalidated/re-evaluated, NO auto re-approval -

function gate4() {
  const s = mkSession()
  const root = s.graph.addNode({ nodeType: 'system_goal', title: 'Checkout', description: 'd', scope: 'checkout' })
  const [tax] = s.proposeRefinement(root.id, [{ nodeType: 'capability', title: 'Tax rule', description: 'd' }])
  const [invoice] = s.proposeRefinement(root.id, [{ nodeType: 'capability', title: 'Invoice rule', description: 'd' }])
  // The invoice rule depends on the tax rule.
  s.graph.addEdge({ source: invoice, target: tax, kind: 'depends_on' })
  const oTax = s.engine.open({ nodeId: tax, kind: 'policy_confirmation', description: 'confirm tax rule' })
  const oInv = s.engine.open({ nodeId: invoice, kind: 'policy_confirmation', description: 'confirm invoice rule' })
  // Both confirmed (the invoice rule is a ready, previously-approved dependent).
  const eTax = s.recordDecision({ obligationId: oTax.id, answer: { kind: 'confirm', answer: '10% tax' }, actorKind: 'user' })
  s.recordDecision({ obligationId: oInv.id, answer: { kind: 'confirm', answer: 'ok' }, actorKind: 'user' })
  expect(s.graph.getNode(tax)?.status).toBe('ready')
  expect(s.graph.getNode(invoice)?.status).toBe('ready')
  // The stakeholder CHANGES the prior tax rule (supersedes the original decision).
  const oTax2 = s.engine.open({ nodeId: tax, kind: 'policy_confirmation', description: 'confirm revised tax rule' })
  const eNew = s.recordDecision({ obligationId: oTax2.id, answer: { kind: 'confirm', answer: '7% tax' }, actorKind: 'user', supersedes: eTax.decisionId })
  // The re-decided node (tax) reflects the new explicit decision.
  expect(s.graph.getNode(tax)?.status).toBe('ready')
  // The dependent (invoice) is pulled back to needs_clarification — invalidated + re-evaluated, and it is
  // NOT auto re-approved (it is not re-stamped ready).
  expect(s.graph.getNode(invoice)?.status).toBe('needs_clarification')
  expect(eNew.impactedNodeIds).toContain(invoice)
  // The superseded original decision is withdrawn; its obligation re-opens.
  expect(s.engine.get(oTax.id)?.status).toBe('open')
  // The scope is not ready again.
  const verdict = s.assessReadiness('checkout', 'impl').verdict
  expect(verdict).toBe('NEEDS_CLARIFICATION')
  return { tax, invoice, eNew: eNew.decisionId, oTax2: oTax2.id, taxStatus: s.graph.getNode(tax)?.status, invStatus: s.graph.getNode(invoice)?.status, verdict }
}

it('gate 4: modifying a prior rule invalidates dependents without auto re-approval (replay-deterministic)', () => {
  const [a, b] = replay(gate4)
  expect(b).toEqual(a)
})

// ---- Gate 5: an agent edit proposal is REJECTED (not silently overwritten) after a version change ----

function gate5() {
  const s = mkSession()
  const root = s.graph.addNode({ nodeType: 'system_goal', title: 'Billing', description: 'd', scope: 'billing' })
  const [cap] = s.proposeRefinement(root.id, [{ nodeType: 'capability', title: 'Invoice format', description: 'd' }])
  const v0 = s.docVersion
  // The agent proposes an edit against the current version v0.
  const propId = s.proposeRevision({ changedNodeIds: [cap], origin: 'agent', description: 'change invoice format' })
  // ...but a stakeholder decision advances the document (version moves to v0+1).
  const o = s.engine.open({ nodeId: cap, kind: 'policy_confirmation', description: 'confirm format policy' })
  s.recordDecision({ obligationId: o.id, answer: { kind: 'confirm', answer: 'ok' }, actorKind: 'user' })
  const vNow = s.docVersion
  expect(vNow).toBe(v0 + 1)
  // Applying the stale proposal (which expects v0) is REJECTED — never silently overwritten.
  const stale = s.applyRevision(propId, v0)
  expect(stale.applied).toBe(false)
  expect(stale.rejected).toBe(true)
  // A fresh proposal captured at the CURRENT version applies cleanly.
  const freshId = s.proposeRevision({ changedNodeIds: [cap], origin: 'agent' })
  const fresh = s.applyRevision(freshId, vNow)
  expect(fresh.applied).toBe(true)
  return { propId, freshId, v0, vNow, staleRejected: stale.rejected, freshApplied: fresh.applied }
}

it('gate 5: a version-stale agent edit proposal is rejected, not overwritten (replay-deterministic)', () => {
  const [a, b] = replay(gate5)
  expect(b).toEqual(a)
})

// ---- Gate 6: the same decision is not asked infinitely --------------------------------------------

function gate6() {
  const s = mkSession()
  const root = s.graph.addNode({ nodeType: 'system_goal', title: 'Plan trip', description: 'd', scope: 'trip' })
  const ids = s.proposeRefinement(root.id, [
    { nodeType: 'capability', title: 'Flight window', description: 'd' },
    { nodeType: 'capability', title: 'Hotel window', description: 'd' },
    { nodeType: 'capability', title: 'Budget cap', description: 'd' },
  ])
  for (const nid of ids) s.engine.open({ nodeId: nid, kind: 'policy_confirmation', description: `confirm ${nid}` })
  // A stakeholder who never resolves (always `unknown`): the loop must still terminate, asking each
  // decision at most once — not loop to the budget.
  let asked = 0
  const askedIds: string[] = []
  const result = s.runTurn({
    budget: 100,
    responder: (o) => {
      asked += 1
      askedIds.push(o.obligationId)
      return { kind: 'unknown' }
    },
  })
  expect(asked).toBe(3)
  expect(new Set(askedIds).size).toBe(3)
  // Stopped because no eligible candidate remained — the budget was NOT exhausted.
  expect(result.steps).toBe(3)
  expect(result.budgetLeft).toBe(97)
  // Risk preserved: nothing was confirmed, so the scope is not ready.
  expect(result.finalVerdict).toBe('NEEDS_CLARIFICATION')
  return { asked, askedIds, steps: result.steps, budgetLeft: result.budgetLeft, verdict: result.finalVerdict }
}

it('gate 6: the same decision is never re-asked infinitely (replay-deterministic)', () => {
  const [a, b] = replay(gate6)
  expect(b).toEqual(a)
})

// ---- Supplementary (P4): a correctly-labeled SIMULATED answer discharges (the experiment proxy) ----
// Not one of the six §6.6 gates, but it fixes the Option-B anti-fabrication semantics at the session
// layer: a `simulated_user` + `simulated_user_answer` answer IS a legitimate discharger (the study's
// stand-in decision-maker), yet it can NEVER launder a node into `user_confirmed`/`analyst_approved`.

it('a simulated_user answer discharges but is reported as a proxy, never user_confirmed', () => {
  const s = mkSession()
  const root = s.graph.addNode({ nodeType: 'system_goal', title: 'Refund policy', description: 'd', scope: 'sim' })
  const [cap] = s.proposeRefinement(root.id, [{ nodeType: 'capability', title: 'Refund window', description: 'd' }])
  const o = s.engine.open({ nodeId: cap, kind: 'policy_confirmation', description: 'confirm refund window' })
  const eff = s.recordDecision({ obligationId: o.id, answer: { kind: 'confirm', answer: '7 days' }, actorKind: 'simulated_user' })
  // It discharged the obligation (the study needs a non-degenerate signal)...
  expect(s.engine.get(o.id)?.status).toBe('satisfied')
  expect(eff.dischargedObligationIds).toContain(o.id)
  expect(eff.fabricated).toBe(false)
  // ...but the node's source is the HONEST proxy provenance, never a laundered confirmation.
  expect(s.graph.getNode(cap)?.source).toBe('simulated_user_answer')
  expect(s.graph.getNode(cap)?.source).not.toBe('user_confirmed')
  expect(s.graph.getNode(cap)?.source).not.toBe('analyst_approved')
  // The scope is ready (the obligation is resolved) — a simulated answer is a real, labeled discharger.
  expect(s.assessReadiness('sim', 'impl').verdict).toBe('READY')
})

it('a simulated_user answer can NEVER be stamped user_confirmed (no laundering path)', () => {
  const s = mkSession()
  const root = s.graph.addNode({ nodeType: 'system_goal', title: 'Refund policy', description: 'd', scope: 'sim2' })
  const [cap] = s.proposeRefinement(root.id, [{ nodeType: 'capability', title: 'Refund window', description: 'd' }])
  const o = s.engine.open({ nodeId: cap, kind: 'policy_confirmation', description: 'confirm refund window' })
  // Directly forcing the illegal pairing must throw at the single enforcement point (provenance).
  expect(() =>
    s.engine.discharge(o.id, {
      kind: 'decision',
      decision: { decisionId: 'x', actorKind: 'simulated_user', provenance: 'user_confirmed', answer: '7 days' },
    }),
  ).toThrowError()
})
