/**
 * Decision provenance store + propagation (conceptual-model sections 5, 9).
 *
 * A decision is the unit of provenance: it names its target nodes, the obligations it addresses, the
 * actor, and the provenance it stamps. The store is the single choke point through which every
 * decision is recorded, so the anti-fabrication invariant is structural:
 *   - `assertProvenance` runs on every record (a simulated user can never stamp `user_confirmed`).
 *   - an LLM guess (`AI_hypothesis`) is not a legal stamp for any decision-gated provenance.
 *
 * Propagation (section 9, `decision_withdrawn` / `propagation_invalidate`): when a decision is
 * withdrawn or superseded, the obligations it discharged and the nodes it grounded are re-opened and
 * moved back to `needs_clarification` — **never silently re-approved**. The affected graph is the
 * computed impact set, so a later readiness assessment sees the true state.
 */
import type {
  ActorKind,
  NodeStatus,
  ProvenanceStatus,
  RefinementEvent,
  RequirementDecision,
} from './types.js'
import type { IdGen } from './id.js'
import { randomIdGen } from './id.js'
import type { RequirementGraph } from './graph.js'
import type { ObligationEngine } from './obligations.js'
import { assertProvenance } from './provenance.js'

export class DecisionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DecisionError'
  }
}

export interface NewDecision {
  question: string
  answer: string
  actorKind: ActorKind
  provenance: ProvenanceStatus
  targetNodeIds?: string[]
  obligationIds?: string[]
  options?: string[]
  freeText?: string
  justification?: string
  /** If set, this decision supersedes (and withdraws) the named decision, triggering propagation. */
  supersedes?: string
}

export interface PropagationResult {
  /** Decision ids withdrawn as a result. */
  withdrawnDecisionIds: string[]
  /** Obligation ids re-opened by the propagation. */
  reopenedObligationIds: string[]
  /** Node ids whose status was changed by the propagation (with old status). */
  nodeStatusChanges: Array<{ nodeId: string; from: NodeStatus; to: NodeStatus }>
  /** The computed impact set: node ids affected (the affected graph). */
  affectedGraph: string[]
}

/** The event sink a DecisionStore appends to. Matches `EventLog.append`, so an `EventLog` (or a
 *  harness recorder) can be passed directly. */
export interface DecisionEventSink {
  append(event: RefinementEvent): void
}

export interface DecisionStoreOptions {
  idGen?: IdGen
  now?: () => number
  events?: DecisionEventSink
  /** The graph + obligation engine decisions act on. Required for supersession propagation; a store
   *  without them can still record/withdraw-explicitly, but supersession only marks withdrawn. */
  graph?: RequirementGraph
  engine?: ObligationEngine
}

export class DecisionStore {
  private decisions = new Map<string, RequirementDecision>()
  private readonly idGen: IdGen
  private readonly now: () => number
  private readonly events?: DecisionEventSink
  private readonly graph?: RequirementGraph
  private readonly engine?: ObligationEngine

  constructor(options: DecisionStoreOptions = {}) {
    this.idGen = options.idGen ?? randomIdGen()
    this.now = options.now ?? (() => Date.now())
    this.events = options.events
    this.graph = options.graph
    this.engine = options.engine
  }

  // ---- queries ---------------------------------------------------------

  get(id: string): RequirementDecision | undefined {
    return this.decisions.get(id)
  }
  all(): RequirementDecision[] {
    return [...this.decisions.values()]
  }
  active(): RequirementDecision[] {
    return this.all().filter((d) => d.status === 'recorded')
  }
  /** Active (recorded) decisions that ground a node with a *confirmed* provenance. */
  decisionsFor(nodeId: string): RequirementDecision[] {
    return this.active().filter((d) => d.targetNodeIds.includes(nodeId))
  }
  decisionsForObligation(obligationId: string): RequirementDecision[] {
    return this.active().filter((d) => d.obligationIds.includes(obligationId))
  }

  /**
   * Bulk-load a set of decisions (session restore). Replaces the current set — used when a persisted
   * `RefinementSession` snapshot is re-materialized.
   */
  load(records: RequirementDecision[]): void {
    this.decisions = new Map(records.map((d) => [d.decisionId, d]))
  }

  // ---- record ----------------------------------------------------------

  /**
   * Record a decision. Enforces the provenance bar (anti-fabrication) and, if `supersedes` is set,
   * withdraws the named decision and runs propagation. Returns the recorded decision.
   */
  record(input: NewDecision): RequirementDecision {
    // Anti-fabrication: the actor must be allowed to stamp the requested provenance.
    assertProvenance(input.actorKind, input.provenance)
    // An LLM guess can never be recorded as a decision at all.
    if (input.provenance === 'AI_hypothesis') {
      throw new DecisionError('a decision cannot be stamped AI_hypothesis (an LLM guess is not a decision)')
    }
    if (!input.question.trim()) throw new DecisionError('a decision requires a question')
    if (!input.answer.trim()) throw new DecisionError('a decision requires an answer')

    const decision: RequirementDecision = {
      decisionId: this.idGen('dec'),
      targetNodeIds: input.targetNodeIds ?? [],
      obligationIds: input.obligationIds ?? [],
      question: input.question,
      options: input.options,
      freeText: input.freeText,
      answer: input.answer,
      actorKind: input.actorKind,
      provenance: input.provenance,
      status: 'recorded',
      timestamp: this.now(),
      justification: input.justification,
      supersedes: input.supersedes,
    }
    this.decisions.set(decision.decisionId, decision)
    this.events?.append({ type: 'decision_recorded', decisionId: decision.decisionId })

    if (input.supersedes) {
      this.withdraw(input.supersedes, decision.decisionId)
    }
    return decision
  }

  // ---- withdraw + propagation ------------------------------------------

  /**
   * Withdraw a decision and propagate: re-open the obligations it discharged and pull the grounded
   * nodes back to `needs_clarification`. **Never silently re-approves** (section 9). Returns the
   * computed impact set.
   */
  withdraw(id: string, supersededBy?: string): PropagationResult {
    if (!this.graph || !this.engine) {
      throw new DecisionError('DecisionStore was created without a graph/engine; cannot propagate a withdrawal')
    }
    const graph = this.graph
    const engine = this.engine
    const decision = this.decisions.get(id)
    if (!decision) throw new DecisionError(`no decision ${id}`)
    if (decision.status === 'withdrawn') return { withdrawnDecisionIds: [], reopenedObligationIds: [], nodeStatusChanges: [], affectedGraph: [] }
    decision.status = 'withdrawn'
    if (supersededBy) decision.supersedes = undefined // the superseding decision records the link
    this.events?.append({ type: 'decision_withdrawn', decisionId: id, supersedes: supersededBy })

    // 1. Restore to `open` every obligation this decision moved out of `open`: ones it closed
    //    (satisfied/waived) AND ones it deferred. A deferral is a "come back later" the decision
    //    recorded; voiding the decision un-defers (re-opens) it. Never silently re-approves.
    const reopenedObligationIds: string[] = []
    for (const oid of decision.obligationIds) {
      const o = engine.get(oid)
      if (!o) continue
      if (o.status === 'satisfied' || o.status === 'waived' || o.status === 'deferred') {
        engine.reopen(oid, `decision ${id} withdrawn`)
        reopenedObligationIds.push(oid)
      }
    }

    // 2. Compute the affected graph: the decision's nodes + everything that depends_on / is constrained
    //    by them, transitively (downstream dependents), plus their refines descendants.
    const seeds = [...decision.targetNodeIds]
    const affected = computeImpactSet(graph, seeds)

    // 3. Pull affected nodes back to needs_clarification (never silently re-approved). A node is
    //    demoted only if it was grounded by this (now-withdrawn) confirmed decision.
    const nodeStatusChanges: Array<{ nodeId: string; from: NodeStatus; to: NodeStatus }> = []
    for (const nid of affected) {
      const node = graph.getNode(nid)
      if (!node) continue
      const grounded = this.decisionGrounded(node.id, decision.decisionId)
      if (!grounded) continue
      const from = node.status
      const to: NodeStatus = 'needs_clarification'
      if (from === to) continue
      node.status = to
      node.version += 1
      nodeStatusChanges.push({ nodeId: nid, from, to })
    }

    this.events?.append({
      type: 'propagation_invalidate',
      nodeIds: affected,
      triggerDecisionId: id,
    })

    return {
      withdrawnDecisionIds: [id],
      reopenedObligationIds,
      nodeStatusChanges,
      affectedGraph: affected,
    }
  }

  /**
   * True iff a node's confirmed grounding is (at least partly) this decision: the node has a confirmed
   * source AND this recorded decision targets it. Used to decide whether a withdrawal demotes the node.
   */
  private decisionGrounded(nodeId: string, decisionId: string): boolean {
    const d = this.decisions.get(decisionId)
    if (!d) return false
    return d.targetNodeIds.includes(nodeId) && (d.provenance === 'user_confirmed' || d.provenance === 'analyst_approved')
  }

  /** True iff the node is currently grounded by an active confirmed decision (for readiness). */
  nodeIsConfirmed(nodeId: string): boolean {
    return this.active().some(
      (d) => d.targetNodeIds.includes(nodeId) && (d.provenance === 'user_confirmed' || d.provenance === 'analyst_approved'),
    )
  }
}

/**
 * Compute the impact (affected) graph for a set of seed nodes: the seeds plus, transitively,
 *   - every node that depends_on a seed (downstream dependents),
 *   - every node a seed constrains,
 *   - every refines descendant of a seed.
 * Cross-links are followed in the direction that matters for a change: a change to X propagates to the
 * nodes that depend on / are constrained by X, and to X's own refines subtree.
 */
export function computeImpactSet(graph: RequirementGraph, seeds: string[]): string[] {
  const affected = new Set<string>()
  const stack = [...seeds]
  while (stack.length) {
    const cur = stack.pop()!
    if (affected.has(cur)) continue
    affected.add(cur)
    // refines descendants of cur.
    for (const child of graph.children(cur)) affected.has(child.id) || stack.push(child.id)
    // nodes that depend on cur, and nodes cur constrains.
    for (const e of graph.allEdges()) {
      if (e.kind === 'depends_on' && e.target === cur) stack.push(e.source)
      if (e.kind === 'constrains' && e.source === cur) stack.push(e.target)
    }
  }
  // Remove any seed that does not exist (dangling).
  for (const s of [...affected]) if (!graph.getNode(s)) affected.delete(s)
  return [...affected]
}
