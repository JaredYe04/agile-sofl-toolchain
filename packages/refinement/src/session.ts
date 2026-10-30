/**
 * RefinementSession — the requirement-layer DOMAIN-TOOL + turn-orchestration core (P4, task book §6).
 *
 * This is NOT a second agent system (task book §6.1). It is the single, headless, deterministic
 * implementation of the typed domain tools over the P3 core (graph / obligations / decisions /
 * selector / readiness / events). The Studio agent and the experiment harness consume it as THIN
 * wrappers — the agent loop still owns turns, permissions, proposal approval, and the LLM; this
 * module owns the requirement-layer semantics so there is exactly one place they live.
 *
 * The typed domain tools (task book §6.1; names map to the agent-tool convention):
 *   readRefinementTree            -> read_requirement_graph / read_refinement_tree
 *   proposeRefinement             -> propose_refinement (candidate structure, source = AI_hypothesis)
 *   checkObligations              -> check_refinement_obligations (deterministic graph detectors)
 *   listOpenObligations           -> list_open_decisions
 *   selectNextClarification       -> propose_clarification / select_next_clarification (cost-aware)
 *   recordDecision                -> record_decision (isolated actor; anti-fabrication enforced)
 *   computeChangeImpact           -> compute_change_impact (withdrawal / supersession propagation)
 *   proposeRevision / applyRevision -> preview_revision / apply_approved_revision (version-gated)
 *   assessReadiness               -> assess_readiness (the explicit stop mechanism)
 *
 * Turn orchestration (task book §6.3): check obligations -> select the next (cost-aware)
 * clarification -> route it to a responder (the human, or in experiments the ISOLATED simulated
 * stakeholder oracle) -> record the decision with its provenance -> re-assess -> stop on READY /
 * BLOCKED / no eligible candidate / budget out. `recordDecision` is never invoked by the agent
 * impersonating the user: the actor is passed in explicitly and `assertProvenance` (P3) guarantees an
 * LLM guess can never be stamped `user_confirmed`.
 *
 * Replayable: constructed from injectable id generators + a clock, so the same operation sequence
 * reproduces the same ids / verdicts (the §6.6 / P3 replay invariant).
 */
import { RequirementGraph } from './graph.js'
import type { AddNodeInput } from './graph.js'
import { ObligationEngine } from './obligations.js'
import { DecisionStore, computeImpactSet } from './decisions.js'
import { ReadinessAssessor } from './readiness.js'
import { EventLog } from './events.js'
import { selectNext, computeBenefit, computeCost, DEFAULT_WEIGHTS } from './selector.js'
import type { SelectionContext, ScoredCandidate, SelectorWeights } from './selector.js'
import { isConfirmedSource } from './provenance.js'
import type { IdGen } from './id.js'
import { randomIdGen } from './id.js'
import type {
  ActorKind,
  ClarificationCandidate,
  NodeStatus,
  ProvenanceStatus,
  RefinementObligation,
  ReadinessAssessment,
  ReadinessVerdict,
} from './types.js'

/** How a stakeholder answers a clarification (task book §6.2 option set). */
export type DecisionAnswerKind = 'confirm' | 'answer' | 'unknown' | 'defer' | 'reject' | 'none_of_above'

export interface DecisionAnswer {
  kind: DecisionAnswerKind
  /** The concrete value / free text the stakeholder chose (for confirm/answer). */
  answer?: string
  freeText?: string
  options?: string[]
  justification?: string
}

/** A single clarification presented to the stakeholder (the question + the obligation it addresses). */
export interface ClarificationOutcome {
  candidate: ClarificationCandidate
  /** The obligation this question addresses (drives the answer's effect). */
  obligationId: string
  targetNodeId: string
  question: string
  isHighImpactPolicy: boolean
  /** The cost-aware score + explainable reasons (surfaced in the UI per §6.2). */
  score: number
  reasons: string[]
  gated: boolean
}

/** The effect of a recorded decision (never fabricates; `fabricated` is a structural tripwire). */
export interface DecisionEffect {
  decisionId: string
  /** Obligations that received an answer this turn (removed from future re-asking). */
  answeredObligationIds: string[]
  dischargedObligationIds: string[]
  deferredObligationIds: string[]
  promotedNodeIds: string[]
  nodeStatusChanges: Array<{ nodeId: string; from: NodeStatus; to: NodeStatus }>
  nodeSourceChanges: Array<{ nodeId: string; from: ProvenanceStatus; to: ProvenanceStatus }>
  /**
   * The full impact set of a superseding decision (the changed node + transitive dependents). Every
   * node in here is re-evaluated; the ready ones are pulled back to needs_clarification (no silent
   * re-approval). Empty for a fresh (non-superseding) decision.
   */
  impactedNodeIds: string[]
  /** True ONLY if a non-real actor somehow stamped a confirmed provenance. Structurally always false. */
  fabricated: boolean
}

export interface RevisionProposal {
  id: string
  /** The document version this proposal was based on (captured at proposal time). */
  baseDocVersion: number
  changedNodeIds: string[]
  origin: 'agent' | 'analyst' | 'user'
  description: string
}

export interface ApplyRevisionResult {
  applied: boolean
  rejected: boolean
  reason?: string
  revisionId?: string
}

export interface TurnResult {
  steps: number
  budgetLeft: number
  finalVerdict: ReadinessVerdict
  finalAssessment: ReadinessAssessment
  actions: Array<{
    obligationId: string
    question: string
    answerKind: DecisionAnswerKind
    effect: DecisionEffect
  }>
}

export interface SessionOptions {
  idGen?: IdGen
  obligationIdGen?: IdGen
  decisionIdGen?: IdGen
  readinessIdGen?: IdGen
  now?: () => number
  /** Starting document version (e.g. restored from a saved document). */
  docVersion?: number
}

/** The confirming provenance an actor is allowed to stamp for a confirm/answer (anti-fabrication). */
function confirmingProvenance(actorKind: ActorKind): ProvenanceStatus {
  if (actorKind === 'authorized_decider') return 'analyst_approved'
  if (actorKind === 'simulated_user') return 'simulated_user_answer'
  return 'user_confirmed'
}

export class RefinementSession {
  readonly graph: RequirementGraph
  readonly engine: ObligationEngine
  readonly store: DecisionStore
  readonly events: EventLog
  private readonly assessor: ReadinessAssessor
  private readonly weights: SelectorWeights
  /** Document version — bumped on every structural/state mutation; gates applyRevision. */
  docVersion: number
  /** Obligations that received an answer (any kind). Excluded from re-asking (no infinite re-ask). */
  private readonly answeredObligationIds = new Set<string>()
  /** Per-obligation re-ask counter (belt-and-suspenders cap in addition to `answered`). */
  private readonly reAskCounts: Record<string, number> = {}
  /** Pending revision proposals (preview_revision -> apply_approved_revision). */
  private readonly proposals = new Map<string, RevisionProposal>()

  constructor(options: SessionOptions = {}) {
    const now = options.now ?? (() => Date.now())
    const graph = new RequirementGraph(options.idGen ?? randomIdGen())
    const engine = new ObligationEngine({ idGen: options.obligationIdGen ?? randomIdGen(), now })
    const events = new EventLog(now)
    const store = new DecisionStore({
      idGen: options.decisionIdGen ?? randomIdGen(),
      now,
      events,
      graph,
      engine,
    })
    this.graph = graph
    this.engine = engine
    this.store = store
    this.assessor = new ReadinessAssessor(options.readinessIdGen ?? randomIdGen())
    this.events = events
    this.docVersion = options.docVersion ?? 0
    this.weights = DEFAULT_WEIGHTS
  }

  // ---- read ------------------------------------------------------------

  /** read_requirement_graph / read_refinement_tree — a compact structured view (no LLM, no I/O). */
  readRefinementTree(opts: { scope?: string } = {}): {
    nodes: number
    edges: number
    openObligations: number
    openCriticalObligations: number
    verdictPreview: ReadinessVerdict
  } {
    const scope = opts.scope ?? this.primaryScope()
    const all = this.engine.all()
    return {
      nodes: this.graph.size(),
      edges: this.graph.allEdges().length,
      openObligations: all.filter((o) => o.status === 'open' || o.status === 'disputed').length,
      openCriticalObligations: this.engine.openCritical().length,
      verdictPreview: this.assessReadiness(scope, 'impl').verdict,
    }
  }

  /** check_refinement_obligations — run the deterministic graph detectors (idempotent, no LLM). */
  checkObligations(): { opened: RefinementObligation[]; discharged: RefinementObligation[] } {
    return this.engine.detect(this.graph)
  }

  /** list_open_decisions — the open obligations that still need a stakeholder decision/clarification. */
  listOpenObligations(opts: { severity?: 'critical' | 'major' | 'minor'; status?: RefinementObligation['status'] } = {}): RefinementObligation[] {
    let list = this.engine.all().filter((o) => (opts.status ? o.status === opts.status : o.status === 'open' || o.status === 'disputed'))
    if (opts.severity) list = list.filter((o) => o.severity === opts.severity)
    return list
  }

  // ---- propose structure (candidates) ----------------------------------

  /**
   * propose_refinement — add candidate children under `parentId`. Candidates are NOT confirmed: they
   * carry source = AI_hypothesis and status = draft (an LLM hypothesis, never user_confirmed). The
   * stakeholder confirms them via recordDecision, the only path to a confirmed source.
   */
  proposeRefinement(
    parentId: string,
    children: Array<Partial<AddNodeInput> & { nodeType: AddNodeInput['nodeType']; title: string }>,
  ): string[] {
    const parent = this.graph.getNode(parentId)
    if (!parent) throw new Error(`proposeRefinement: parent ${parentId} does not exist`)
    const ids: string[] = []
    for (let i = 0; i < children.length; i++) {
      const c = children[i]
      const node = this.graph.addNode({
        nodeType: c.nodeType,
        title: c.title,
        description: c.description ?? '',
        scope: c.scope ?? parent.scope,
        parentId,
        ordering: c.ordering ?? i,
        status: c.status ?? 'draft',
        criticality: c.criticality ?? 0.5,
        // A proposed candidate is an LLM hypothesis, never a confirmed value (anti-fabrication).
        source: c.source ?? 'AI_hypothesis',
        owner: c.owner,
        artifactRefs: c.artifactRefs,
      })
      ids.push(node.id)
      this.events.append({ type: 'node_created', nodeId: node.id })
    }
    this.docVersion += 1
    return ids
  }

  // ---- clarification selection (cost-aware) ----------------------------

  /**
   * select_next_clarification — build one candidate per open, not-yet-answered obligation and return
   * the top one by the cost-aware selector (or null when none is eligible / budget out). Candidates
   * for obligations already answered are excluded, so a decision is never re-asked (task book §6.6).
   */
  selectNextClarification(opts: { budgetRemaining?: number; stage?: string } = {}): ClarificationOutcome | null {
    const candidates = this.buildCandidates()
    const ctx: SelectionContext = {
      budgetRemaining: opts.budgetRemaining,
      stage: opts.stage,
      reAskCounts: this.reAskCountsByCandidateId(),
    }
    const scored: ScoredCandidate | null = selectNext(candidates, this.graph, this.engine, ctx, this.weights)
    if (!scored) return null
    const c = scored.candidate
    return {
      candidate: c,
      obligationId: c.obligationIds[0],
      targetNodeId: c.targetNodeIds[0],
      question: c.question,
      isHighImpactPolicy: c.isHighImpactPolicy,
      score: scored.score,
      reasons: scored.reasons,
      gated: scored.gated,
    }
  }

  /** One candidate per open obligation that has not yet been answered. Deterministic (insertion order). */
  private buildCandidates(): ClarificationCandidate[] {
    const out: ClarificationCandidate[] = []
    for (const o of this.engine.all()) {
      if (o.status !== 'open' && o.status !== 'disputed') continue
      if (this.answeredObligationIds.has(o.id)) continue
      const zero = this.zeroCandidate(o)
      out.push({
        ...zero,
        estimatedBenefit: computeBenefit(zero, this.graph, this.engine, {}, this.weights).benefit,
        estimatedHumanCost: computeCost(zero, this.weights),
      })
    }
    return out
  }

  /** A throwaway candidate used to derive the surfaced benefit/cost estimates. */
  private zeroCandidate(o: RefinementObligation): ClarificationCandidate {
    return {
      id: `q_${o.id}`,
      targetNodeIds: [o.nodeId],
      obligationIds: [o.id],
      question: o.description,
      choiceOptions: ['confirm', 'unknown', 'defer', 'none_of_above'],
      supportsFreeText: true,
      supportsUnknown: true,
      supportsDefer: true,
      supportsNoneOfAbove: true,
      eligibleState: 'any',
      isHighImpactPolicy: o.policyRequired && o.severity === 'critical',
      priorityReason: '',
      estimatedBenefit: 0,
      estimatedHumanCost: 0,
    }
  }

  /** reAskCounts keyed by candidate id (the selector's lookup key). */
  private reAskCountsByCandidateId(): Record<string, number> {
    const out: Record<string, number> = {}
    for (const [oid, count] of Object.entries(this.reAskCounts)) out[`q_${oid}`] = count
    return out
  }

  // ---- record decision (isolated actor; anti-fabrication) --------------

  /**
   * record_decision — record a stakeholder's answer and apply its effect. The ACTOR is passed in
   * explicitly (the human, or in experiments the ISOLATED simulated stakeholder) — the agent never
   * impersonates the user. `assertProvenance` (P3) + the confirming-provenance derivation guarantee an
   * LLM guess can never be stamped `user_confirmed`.
   *
   *   confirm / answer -> discharge the obligation(s) + advance the node to `ready`; the node's SOURCE
   *                       is set to the actor's HONEST provenance (a simulated answer stays
   *                       `simulated_user_answer`, never `user_confirmed`).
   *   defer            -> the obligation is tracked as `deferred` (NOT a pass); readiness = DEFERRED.
   *   unknown / reject / none_of_above -> NO discharge, NO promotion, NO fabrication: the obligation
   *                       stays open (risk preserved), the node is untouched. Tracked so it is not
   *                       re-asked.
   *
   *   supersedes (optional) -> the new decision withdraws the named prior decision and runs the
   *                       impact-set propagation (dependent nodes re-evaluated, no re-approval).
   */
  recordDecision(opts: {
    obligationId: string
    answer: DecisionAnswer
    actorKind?: ActorKind
    targetNodeIds?: string[]
    justification?: string
    supersedes?: string
  }): DecisionEffect {
    const obligation = this.engine.get(opts.obligationId)
    if (!obligation) throw new Error(`recordDecision: no obligation ${opts.obligationId}`)
    const actorKind = opts.actorKind ?? 'user'
    const targetNodeIds = opts.targetNodeIds ?? [obligation.nodeId]
    const question = obligation.description

    const effect: DecisionEffect = {
      decisionId: '',
      answeredObligationIds: [obligation.id],
      dischargedObligationIds: [],
      deferredObligationIds: [],
      promotedNodeIds: [],
      nodeStatusChanges: [],
      nodeSourceChanges: [],
      impactedNodeIds: [],
      fabricated: false,
    }

    if (opts.answer.kind === 'confirm' || opts.answer.kind === 'answer') {
      // The only provenance a given actor may stamp for a confirmation (anti-fabrication).
      const prov = confirmingProvenance(actorKind)
      const decision = this.store.record({
        question,
        answer: opts.answer.answer ?? opts.answer.freeText ?? 'confirmed',
        freeText: opts.answer.freeText,
        options: opts.answer.options,
        actorKind,
        provenance: prov,
        targetNodeIds,
        obligationIds: [obligation.id],
        justification: opts.answer.justification ?? opts.justification,
        supersedes: opts.supersedes,
      })
      effect.decisionId = decision.decisionId
      // Discharge (the P3 choke point enforces actor/provenance legality).
      try {
        this.engine.discharge(obligation.id, {
          kind: 'decision',
          decision: { decisionId: decision.decisionId, actorKind, provenance: prov, answer: opts.answer.answer ?? 'confirmed' },
        })
        effect.dischargedObligationIds.push(obligation.id)
      } catch {
        // A decision that cannot legally discharge leaves the obligation open (never fabricated).
      }
      // Advance the addressed node(s): status -> ready; source -> the HONEST provenance.
      for (const nid of targetNodeIds) this.promoteNode(nid, prov, effect)
    } else if (opts.answer.kind === 'defer') {
      const decision = this.store.record({
        question,
        answer: opts.answer.answer ?? 'deferred',
        freeText: opts.answer.freeText,
        actorKind,
        provenance: 'deferred',
        targetNodeIds,
        obligationIds: [obligation.id],
        justification: opts.answer.justification ?? opts.justification,
        supersedes: opts.supersedes,
      })
      effect.decisionId = decision.decisionId
      this.engine.defer(obligation.id, opts.answer.answer ?? 'deferred by stakeholder')
      effect.deferredObligationIds.push(obligation.id)
      for (const nid of targetNodeIds) this.setNodeStatus(nid, 'deferred', effect)
    } else {
      // unknown / reject / none_of_above: NO resolution captured. Tracked (deferred provenance), NOT a
      // pass, NOT a fabrication — the obligation stays open and the node is untouched.
      const decision = this.store.record({
        question,
        answer: opts.answer.answer ?? `answered: ${opts.answer.kind} (no value confirmed)`,
        freeText: opts.answer.freeText,
        actorKind,
        provenance: 'deferred',
        targetNodeIds,
        obligationIds: [obligation.id],
        justification: opts.answer.justification ?? `stakeholder responded '${opts.answer.kind}'; no value confirmed`,
        supersedes: opts.supersedes,
      })
      effect.decisionId = decision.decisionId
      // obligation stays open; node untouched; nothing fabricated.
    }

    // Anti-fabrication tripwire: a simulated actor must never have produced a confirmed source.
    if (actorKind === 'simulated_user') {
      for (const nid of targetNodeIds) {
        const node = this.graph.getNode(nid)
        if (node && isConfirmedSource(node.source)) effect.fabricated = true
      }
    }

    // Supersession: the stakeholder changed a prior rule. The store already withdrew the old decision
    // and re-opened its obligations + demoted directly-grounded nodes; here we re-evaluate the FULL
    // impact set (transitive dependents + refines subtree) and pull any still-`ready` node back to
    // needs_clarification — a changed rule invalidates what depends on it, and it is NEVER auto
    // re-approved (task book §6.6: "依赖节点被失效/重评，且不会自动二次批准").
    if (opts.supersedes) {
      const prior = this.store.get(opts.supersedes)
      if (prior) {
        const impact = this.computeChangeImpact(prior.targetNodeIds)
        effect.impactedNodeIds = impact
        // The node(s) just re-decided this turn stay confirmed (an explicit re-decision, not auto);
        // every OTHER node in the impact set (dependents / subtree) is pulled back to
        // needs_clarification — invalidated and re-evaluated, NEVER auto re-approved.
        const reDecided = new Set(targetNodeIds)
        for (const nid of impact) {
          if (reDecided.has(nid)) continue
          const n = this.graph.getNode(nid)
          if (n && n.status === 'ready') this.setNodeStatus(nid, 'needs_clarification', effect)
        }
      }
    }

    // Never re-ask this obligation (task book §6.6); bump version + record the event.
    this.answeredObligationIds.add(obligation.id)
    this.reAskCounts[obligation.id] = (this.reAskCounts[obligation.id] ?? 0) + 1
    this.docVersion += 1
    this.events.append({ type: 'decision_recorded', decisionId: effect.decisionId })
    return effect
  }

  /** Move a node to `ready` and set its source to the HONEST provenance (never a laundered confirm). */
  private promoteNode(nodeId: string, prov: ProvenanceStatus, effect: DecisionEffect): void {
    const node = this.graph.getNode(nodeId)
    if (!node) return
    if (node.status !== 'ready') {
      const from = node.status
      node.status = 'ready'
      node.version += 1
      effect.nodeStatusChanges.push({ nodeId, from, to: 'ready' })
    }
    if (node.source !== prov) {
      effect.nodeSourceChanges.push({ nodeId, from: node.source, to: prov })
      node.source = prov
    }
    if (!effect.promotedNodeIds.includes(nodeId)) effect.promotedNodeIds.push(nodeId)
  }

  private setNodeStatus(nodeId: string, to: NodeStatus, effect: DecisionEffect): void {
    const node = this.graph.getNode(nodeId)
    if (!node || node.status === to) return
    const from = node.status
    node.status = to
    node.version += 1
    effect.nodeStatusChanges.push({ nodeId, from, to })
  }

  // ---- impact + revision (version-gated) --------------------------------

  /** compute_change_impact — the transitive affected set for a set of changed node ids. */
  computeChangeImpact(changedNodeIds: string[]): string[] {
    return computeImpactSet(this.graph, changedNodeIds)
  }

  /**
   * preview_revision — capture a pending agent edit against the CURRENT document version. The captured
   * `baseDocVersion` is what applyRevision checks, so a later version change makes the proposal stale.
   */
  proposeRevision(proposal: { changedNodeIds: string[]; origin?: 'agent' | 'analyst' | 'user'; description?: string }): string {
    const id = `rev_${(this.docVersion + 1).toString(36)}`
    this.proposals.set(id, {
      id,
      baseDocVersion: this.docVersion,
      changedNodeIds: proposal.changedNodeIds,
      origin: proposal.origin ?? 'agent',
      description: proposal.description ?? '',
    })
    return id
  }

  /**
   * apply_approved_revision — apply a proposal ONLY if the document version has not moved since the
   * proposal was made. A version change since the proposal => REJECTED (never silently overwritten).
   */
  applyRevision(proposalId: string, expectedDocVersion: number): ApplyRevisionResult {
    const p = this.proposals.get(proposalId)
    if (!p) return { applied: false, rejected: true, reason: `unknown proposal ${proposalId}` }
    if (this.docVersion !== expectedDocVersion || this.docVersion !== p.baseDocVersion) {
      return {
        applied: false,
        rejected: true,
        reason: `version conflict: proposal based on v${p.baseDocVersion}, caller expected v${expectedDocVersion}, document is at v${this.docVersion}`,
      }
    }
    // Apply: commit the version and record the revision (the node mutations are the agent's; this is
    // the approval + version-commit point).
    this.docVersion += 1
    this.events.append({ type: 'revision_applied', revisionId: proposalId })
    return { applied: true, rejected: false, revisionId: proposalId }
  }

  // ---- readiness --------------------------------------------------------

  /** assess_readiness — the explicit stop mechanism (budget exhaustion is a STOP, never a pass). */
  assessReadiness(scope: string, targetStage: string, opts: { nodeIds?: string[]; budgetRemaining?: number; budgetExhausted?: boolean } = {}): ReadinessAssessment {
    return this.assessor.assess({
      graph: this.graph,
      engine: this.engine,
      decisions: this.store,
      scope: { scope, targetStage, nodeIds: opts.nodeIds, budgetRemaining: opts.budgetRemaining, budgetExhausted: opts.budgetExhausted },
    })
  }

  // ---- turn orchestration (task book §6.3) ------------------------------

  /**
   * Run one agent turn's requirement-layer loop deterministically: check obligations, select the next
   * cost-aware clarification, route it to `responder` (the human, or in experiments the isolated
   * simulated stakeholder oracle), record the decision, re-assess. Stop on READY / BLOCKED, when no
   * eligible candidate remains, or when the budget is exhausted.
   *
   * `responder` is the stakeholder hook; in P5 it is the simulated-stakeholder oracle. When omitted,
   * every question is answered `unknown` (no fabrication, no infinite re-ask).
   */
  runTurn(opts: {
    budget?: number
    stage?: string
    scope?: string
    actorKind?: ActorKind
    responder?: (outcome: ClarificationOutcome) => DecisionAnswer
  } = {}): TurnResult {
    const scope = opts.scope ?? this.primaryScope()
    const stage = opts.stage ?? 'impl'
    const actorKind = opts.actorKind ?? 'user'
    const budget = opts.budget ?? 10
    let budgetLeft = budget
    let step = 0
    const actions: TurnResult['actions'] = []
    let assessment = this.assessReadiness(scope, stage, { budgetRemaining: budgetLeft })

    while (budgetLeft > 0) {
      this.checkObligations()
      if (assessment.verdict === 'READY' || assessment.verdict === 'BLOCKED') break
      const next = this.selectNextClarification({ budgetRemaining: budgetLeft, stage })
      if (!next) break
      const answer: DecisionAnswer = opts.responder ? opts.responder(next) : { kind: 'unknown' }
      const effect = this.recordDecision({ obligationId: next.obligationId, answer, actorKind })
      actions.push({ obligationId: next.obligationId, question: next.question, answerKind: answer.kind, effect })
      budgetLeft -= 1
      step += 1
      assessment = this.assessReadiness(scope, stage, { budgetRemaining: budgetLeft })
      this.events.append({ type: 'readiness_recomputed', scope, verdict: assessment.verdict })
    }

    return { steps: step, budgetLeft, finalVerdict: assessment.verdict, finalAssessment: assessment, actions }
  }

  /** The dominant scope label across the graph (for convenience defaults). */
  private primaryScope(): string {
    const first = this.graph.allNodes()[0]
    return first ? first.scope : 'default'
  }
}
