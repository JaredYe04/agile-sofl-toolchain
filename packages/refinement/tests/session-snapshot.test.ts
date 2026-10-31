import { describe, expect, it } from 'vitest'
import { RefinementSession, deterministicIdGen } from '../src/index.js'

/**
 * P4 persistence — `RefinementSession.snapshot()` / `RefinementSession.restore()` (task book §6.1:
 * "keep the agent decoupled from the persistence model").
 *
 * `RefinementSession` is STATEFUL (graph + obligations + decisions + events + the document version +
 * the answered-obligation set + re-ask counters). The Studio agent loop and the experiment harness are
 * per-call, so they persist a plain snapshot per-project and restore it on each turn. These tests pin
 * the round-trip invariants the decision loop depends on:
 *   - snapshot -> restore -> snapshot is byte-identical (deterministic),
 *   - the no-infinite-re-ask set survives restore (an answered decision is not re-asked),
 *   - the document version survives restore (a version-stale revision stays REJECTED),
 *   - the anti-fabrication semantics survive restore (a simulated_user answer stays a proxy, never
 *     user_confirmed), and
 *   - the snapshot is deep (mutating the snapshot does not corrupt a live session).
 */

const NOW = () => 1

function mkSession(): RefinementSession {
  return new RefinementSession({
    idGen: deterministicIdGen('rn'),
    obligationIdGen: deterministicIdGen('ob'),
    decisionIdGen: deterministicIdGen('dec'),
    readinessIdGen: deterministicIdGen('rdy'),
    now: NOW,
  })
}

/** Restore with the SAME injectables that built the original (a deterministic replay). */
function restoreOf(s: RefinementSession): RefinementSession {
  return RefinementSession.restore(s.snapshot(), {
    idGen: deterministicIdGen('rn'),
    obligationIdGen: deterministicIdGen('ob'),
    decisionIdGen: deterministicIdGen('dec'),
    readinessIdGen: deterministicIdGen('rdy'),
    now: NOW,
  })
}

// A session with a full cross-link + two decided obligations (one confirmed by a real user, one
// answered `unknown`) — enough to exercise every part of the stateful snapshot.
function buildSession(): RefinementSession {
  const s = mkSession()
  const root = s.graph.addNode({ nodeType: 'system_goal', title: 'Checkout', description: 'd', scope: 'checkout' })
  const [tax, invoice] = s.proposeRefinement(root.id, [
    { nodeType: 'capability', title: 'Tax rule', description: 'd' },
    { nodeType: 'capability', title: 'Invoice rule', description: 'd' },
  ])
  s.graph.addEdge({ source: invoice, target: tax, kind: 'depends_on' })
  const oTax = s.engine.open({ nodeId: tax, kind: 'policy_confirmation', description: 'confirm tax rule' })
  const oInv = s.engine.open({ nodeId: invoice, kind: 'policy_confirmation', description: 'confirm invoice rule' })
  s.recordDecision({ obligationId: oTax.id, answer: { kind: 'confirm', answer: '10% tax' }, actorKind: 'user' })
  // The invoice rule is answered `unknown` (recorded, never re-asked, NOT discharged).
  s.recordDecision({ obligationId: oInv.id, answer: { kind: 'unknown' }, actorKind: 'user' })
  return s
}

describe('RefinementSession.snapshot / restore round-trip', () => {
  it('snapshot -> restore -> snapshot is byte-identical (deterministic replay)', () => {
    const s = buildSession()
    const restored = restoreOf(s)
    // The restored session reproduces the exact same state (ids, statuses, sources, decisions, events).
    expect(restored.snapshot()).toEqual(s.snapshot())
    // ...and continues behaving identically (readiness + open-obligation view).
    expect(restored.assessReadiness('checkout', 'impl').verdict).toBe(s.assessReadiness('checkout', 'impl').verdict)
    expect(restored.listOpenObligations().map((o) => o.id)).toEqual(s.listOpenObligations().map((o) => o.id))
  })

  it('the no-infinite-re-ask set survives restore (an answered decision is not re-asked)', () => {
    const s = buildSession()
    const restored = restoreOf(s)
    // In the original, both obligations were answered (tax `confirm`, invoice `unknown`), so neither is
    // eligible for re-selection — the answered set excludes them.
    expect(s.selectNextClarification()).toBeNull()
    // After restore the SAME answered set is in force — no re-ask.
    expect(restored.selectNextClarification()).toBeNull()
    // Contrast: a FRESH session with an open obligation that was NEVER answered DOES offer it — proving
    // the null above comes from the persisted answered-set, not from an empty engine.
    const fresh = mkSession()
    const root = fresh.graph.addNode({ nodeType: 'system_goal', title: 'X', description: 'd', scope: 'x' })
    const [cap] = fresh.proposeRefinement(root.id, [{ nodeType: 'capability', title: 'Y', description: 'd' }])
    fresh.engine.open({ nodeId: cap, kind: 'policy_confirmation', description: 'confirm y' })
    expect(fresh.selectNextClarification()).not.toBeNull()
  })

  it('the document version survives restore (a version-stale revision stays REJECTED)', () => {
    const s = mkSession()
    const root = s.graph.addNode({ nodeType: 'system_goal', title: 'Billing', description: 'd', scope: 'billing' })
    const [cap] = s.proposeRefinement(root.id, [{ nodeType: 'capability', title: 'Invoice format', description: 'd' }])
    const v0 = s.docVersion
    const propId = s.proposeRevision({ changedNodeIds: [cap], origin: 'agent', description: 'change format' })
    // A decision advances the version.
    const o = s.engine.open({ nodeId: cap, kind: 'policy_confirmation', description: 'confirm format' })
    s.recordDecision({ obligationId: o.id, answer: { kind: 'confirm', answer: 'ok' }, actorKind: 'user' })
    const vNow = s.docVersion
    expect(vNow).toBe(v0 + 1)

    const restored = restoreOf(s)
    // The version gate state is preserved: the pre-decision proposal (base v0) is still stale.
    expect(restored.docVersion).toBe(vNow)
    const stale = restored.applyRevision(propId, v0)
    expect(stale.applied).toBe(false)
    expect(stale.rejected).toBe(true)
  })

  it('the anti-fabrication semantics survive restore (a simulated answer stays a proxy, never user_confirmed)', () => {
    const s = mkSession()
    const root = s.graph.addNode({ nodeType: 'system_goal', title: 'Refund policy', description: 'd', scope: 'sim' })
    const [cap] = s.proposeRefinement(root.id, [{ nodeType: 'capability', title: 'Refund window', description: 'd' }])
    const o = s.engine.open({ nodeId: cap, kind: 'policy_confirmation', description: 'confirm refund window' })
    s.recordDecision({ obligationId: o.id, answer: { kind: 'confirm', answer: '7 days' }, actorKind: 'simulated_user' })

    const restored = restoreOf(s)
    // The honest proxy provenance is preserved — never laundered into a confirmed source.
    expect(restored.graph.getNode(cap)?.source).toBe('simulated_user_answer')
    expect(restored.graph.getNode(cap)?.source).not.toBe('user_confirmed')
    // The obligation is still satisfied, and the scope is ready (a labeled proxy is a real discharger).
    expect(restored.engine.get(o.id)?.status).toBe('satisfied')
    expect(restored.assessReadiness('sim', 'impl').verdict).toBe('READY')
  })

  it('the snapshot is deep — mutating it does not corrupt a live session', () => {
    const s = buildSession()
    const snap = s.snapshot()
    // Mutate the snapshot's copies in place.
    snap.graph.nodes[0].title = 'MUTATED'
    snap.graph.nodes[0].artifactRefs.push({ refKind: 'free_text', refId: 'planted' })
    snap.decisions[0].answer = 'MUTATED'
    snap.obligations[0].evidenceRefs.push('planted')
    // The live session is untouched.
    const first = s.graph.allNodes()[0]
    expect(first.title).not.toBe('MUTATED')
    expect(first.artifactRefs.some((r) => r.refId === 'planted')).toBe(false)
    expect(s.store.all().map((d) => d.answer)).not.toContain('MUTATED')
    expect(s.engine.all().some((o) => o.evidenceRefs.includes('planted'))).toBe(false)
    // And the live session still round-trips to the original snapshot.
    expect(s.snapshot()).toEqual(restoreOf(s).snapshot())
  })

  it('a restored session continues to record new decisions and re-snapshots cleanly', () => {
    const s = buildSession()
    const restored = restoreOf(s)
    // Open a NEW obligation on the restored session and decide it — the stateful bookkeeping continues.
    const cap = restored.graph.allNodes().find((n) => n.nodeType === 'capability')!
    const oNew = restored.engine.open({ nodeId: cap.id, kind: 'boundary_condition', description: 'new boundary' })
    const before = restored.docVersion
    restored.recordDecision({ obligationId: oNew.id, answer: { kind: 'confirm', answer: 'ok' }, actorKind: 'user' })
    expect(restored.docVersion).toBe(before + 1)
    // A second restore round-trips the continued state.
    const snap2 = restored.snapshot()
    const restored2 = RefinementSession.restore(snap2, {
      idGen: deterministicIdGen('rn'),
      obligationIdGen: deterministicIdGen('ob'),
      decisionIdGen: deterministicIdGen('dec'),
      readinessIdGen: deterministicIdGen('rdy'),
      now: NOW,
    })
    expect(restored2.snapshot()).toEqual(snap2)
  })
})
