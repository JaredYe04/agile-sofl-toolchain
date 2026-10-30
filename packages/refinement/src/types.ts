/**
 * Domain types for the requirement-level typed refinement structure (research core, P3).
 *
 * Design source: research/effort-aware-refinement/research/conceptual-model.md (sections 2, 3, 4, 5, 6).
 * This module is pure data + enums: no Electron, no I/O, no LLM. It depends only on the parser for
 * spec-level diagnostics reuse (via the obligation checker, not here).
 *
 * Key invariants (see RequirementGraph invariants + graph.ts):
 *   - no cycles in `refines` edges
 *   - no dangling edge endpoints (every edge references existing nodes)
 *   - unique stable node IDs (UUIDs)
 *   - tree depth / child count is NOT a completion metric
 *
 * Anti-fabrication (a hard requirement, conceptual-model section 5):
 *   - an LLM guess can NEVER be set to `user_confirmed` (enforced in provenance.ts)
 */

/** Requirement node kinds (heterogeneous by level; depth does not imply executability). */
export type NodeType =
  | 'system_goal'
  | 'goal'
  | 'capability'
  | 'user_story'
  | 'feature'
  | 'module_ref'
  | 'process_ref'
  | 'data_ref'
  | 'constraint'
  | 'non_functional_goal'
  | 'acceptance_scenario'

/** Typed edge kinds. `refines` forms the primary tree; the rest are cross-links (may be many-to-many). */
export type EdgeKind =
  | 'refines'
  | 'depends_on'
  | 'constrains'
  | 'conflicts_with'
  | 'satisfies'
  | 'traces_to'

/** AND/OR/optional/n-of-m decomposition semantics on `refines` edges (KAOS-style minimal subset). */
export type DecompositionSemantics = 'AND' | 'OR' | 'OPTIONAL' | 'n_of_m'

/** Node lifecycle (explicit state machine, conceptual-model section 4; NOT a frontend color). */
export type NodeStatus =
  | 'draft'
  | 'needs_clarification'
  | 'ready'
  | 'deferred'
  | 'blocked'
  | 'invalidated'

/**
 * Decision / provenance status (anti-fabrication, conceptual-model section 5).
 * `user_confirmed` may only be set by a real (or explicitly simulated, in experiments) actor through
 * `record_decision`; it can NEVER be set to this value by an LLM guess. `simulated_user_answer` is the
 * experiment-only status for simulated-stakeholder answers (reported as interaction proxies only).
 */
export type ProvenanceStatus =
  | 'AI_hypothesis'
  | 'source_text_observation'
  | 'user_confirmed'
  | 'simulated_user_answer'
  | 'analyst_approved'
  | 'deferred'

/** Obligation severity. */
export type ObligationSeverity = 'critical' | 'major' | 'minor'

/** Obligation lifecycle. */
export type ObligationStatus = 'open' | 'satisfied' | 'disputed' | 'deferred' | 'waived'

/**
 * Detector class — the critical distinction (task book section 4.4).
 *  - mechanical: deterministic checker, no LLM (testable, must not require a model).
 *  - llm_candidate: LLM raises a CANDIDATE alert only; must be confirmed or dismissed by a decision.
 *  - user_decision: cannot be auto-discharged; requires an authorized actor.
 */
export type DetectorClass = 'mechanical' | 'llm_candidate' | 'user_decision'

/** Actor kind for a recorded decision. In experiments the simulated actor is isolated. */
export type ActorKind = 'user' | 'authorized_decider' | 'simulated_user'

/** Readiness verdicts (conceptual-model section 6). */
export type ReadinessVerdict =
  | 'READY'
  | 'NEEDS_CLARIFICATION'
  | 'DEFERRED'
  | 'BLOCKED'
  | 'INCOMPLETE_WITH_RISK'

/** A stable reference to an existing artifact (informal node / hybrid AST / GUI screen). A reference, not a duplicate. */
export interface ArtifactRef {
  /** Which artifact system this points into. */
  refKind: 'informal_node' | 'hybrid_process' | 'hybrid_type' | 'hybrid_inv' | 'gui_screen' | 'free_text'
  /** Stable id in the target system (informal node id, hybrid process/type name, gui screenId, or free text). */
  refId: string
}

/** A requirement node in the typed refinement structure. */
export interface RequirementNode {
  /** Stable UUID. A name collision is never an identity collision. */
  id: string
  nodeType: NodeType
  title: string
  description: string
  /** Scope label (e.g. the current task/feature area this node belongs to). */
  scope: string
  /** Primary-tree parent (only meaningful for `refines` children). */
  parentId?: string
  /** Ordering among siblings. */
  ordering: number
  /** Document/node version (bumped on mutation; used for stale-proposal rejection). */
  version: number
  /** Provenance of this node's content. */
  source: ProvenanceStatus
  owner?: string
  status: NodeStatus
  /** Relative importance (0 = low .. 1 = high). Used by the selector and readiness. */
  criticality: number
  /** References to existing artifacts (join points, not duplicates). */
  artifactRefs: ArtifactRef[]
}

/** A typed edge (primary `refines` tree edge or cross-link). */
export interface RefinementEdge {
  id: string
  source: string
  target: string
  kind: EdgeKind
  /** Only meaningful when kind === 'refines'. */
  decompositionSemantics?: DecompositionSemantics
  evidence?: string
  version: number
}

/**
 * A first-class, explainable refinement obligation (the core contribution, conceptual-model section 3).
 * Each obligation names its detector class, evidence, and discharge condition.
 */
export interface RefinementObligation {
  id: string
  nodeId: string
  /** Obligation kind (see ObligationKind). */
  kind: string
  description: string
  severity: ObligationSeverity
  status: ObligationStatus
  detectorClass: DetectorClass
  /** Which checker/originator produced this obligation (e.g. an ASFL diagnostic code or 'requirement-graph'). */
  checkerOrigin: string
  /** Evidence references (artifact refs, decision ids, diagnostic codes). */
  evidenceRefs: string[]
  /** True when discharge requires an explicit policy/role confirmation (cannot default). */
  policyRequired: boolean
  lastEvaluatedAt: number
}

/** A recorded clarification/decision answer (the unit of provenance). */
export interface RequirementDecision {
  decisionId: string
  targetNodeIds: string[]
  obligationIds: string[]
  question: string
  options?: string[]
  freeText?: string
  answer: string
  actorKind: ActorKind
  /** Provenance status assigned to the answer (anti-fabrication enforced at set-time). */
  provenance: ProvenanceStatus
  status: 'open' | 'recorded' | 'withdrawn'
  timestamp: number
  justification?: string
  /** A decision supersedes (and thereby withdraws) the named decision, enabling propagation. */
  supersedes?: string
}

/**
 * A clarification question candidate, ranked by the cost-aware selector.
 * `estimatedBenefit` (expected quality gain) and `estimatedHumanCost` (effort proxy) are HEURISTIC
 * ESTIMATES to be calibrated; the policy is a hypothesis under test (RQ3), not established theory.
 */
export interface ClarificationCandidate {
  id: string
  targetNodeIds: string[]
  obligationIds: string[]
  question: string
  choiceOptions?: string[]
  supportsFreeText: boolean
  supportsUnknown: boolean
  supportsDefer: boolean
  supportsNoneOfAbove: boolean
  /** Expected quality gain (heuristic estimate; calibrated in P6). */
  estimatedBenefit: number
  /** Estimated stakeholder effort (heuristic estimate; measured cost is the oracle's actual interaction count). */
  estimatedHumanCost: number
  /** Why this candidate was prioritized (explainable; surfaced in the UI). */
  priorityReason: string
  /** The node status/obligation state in which this candidate is eligible to be asked. */
  eligibleState: NodeStatus | 'any'
  /** True when this candidate addresses a high-impact policy (gated, not ignored by the division). */
  isHighImpactPolicy: boolean
}

/** A tracked, reversible revision of the structure. */
export interface RequirementRevision {
  id: string
  before: string // serialized snapshot (JSON)
  after: string // serialized snapshot (JSON)
  changedObjects: string[]
  /** Computed impact set: node ids affected (for propagation). */
  affectedGraph: string[]
  approvedBy: string
  origin: 'agent' | 'analyst' | 'user'
  version: number
  /** Undo metadata (enables revert). */
  undoMetadata: Record<string, unknown>
}

/** The result of a readiness assessment over a scope (conceptual-model section 6). */
export interface ReadinessAssessment {
  id: string
  scope: string
  targetStage: string
  unresolvedCriticalObligations: string[]
  deferredObligations: string[]
  checkerDiagnostics: string[]
  decisionProvenance: string[]
  verdict: ReadinessVerdict
  reason: string
}

/** Domain events (append-only, replayable; conceptual-model section 9). */
export type RefinementEvent =
  | { type: 'node_created'; nodeId: string }
  | { type: 'node_updated'; nodeId: string }
  | { type: 'node_moved'; nodeId: string; fromParent?: string; toParent?: string }
  | { type: 'node_soft_deleted'; nodeId: string }
  | { type: 'edge_added'; edgeId: string }
  | { type: 'edge_removed'; edgeId: string }
  | { type: 'obligation_opened'; obligationId: string; nodeId: string }
  | { type: 'obligation_discharged'; obligationId: string }
  | { type: 'decision_recorded'; decisionId: string }
  | { type: 'decision_withdrawn'; decisionId: string; supersedes?: string }
  | { type: 'propagation_invalidate'; nodeIds: string[]; triggerDecisionId?: string }
  | { type: 'readiness_recomputed'; scope: string; verdict: ReadinessVerdict }
  | { type: 'revision_applied'; revisionId: string }
