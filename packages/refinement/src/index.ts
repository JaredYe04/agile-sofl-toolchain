/**
 * @agile-sofl/refinement — the requirement-level typed refinement structure (research core, P3).
 *
 * Pure, headless, deterministic: no Electron, no I/O, no LLM. The Studio agent layer (P4) exposes thin
 * tools over this core (`read_requirement_graph`, `list_obligations`, `select_next_clarification`,
 * `record_decision`, `assess_readiness`); the experiment harness (P5) consumes the selector + readiness.
 *
 * The anti-fabrication invariant is structural: provenance is enforced in exactly one place
 * (provenance.ts, called by decisions.ts and obligations.ts), so no code path can launder an LLM guess
 * into a confirmed decision or auto-close a decision-gated obligation.
 */

// Domain types and enums.
export * from './types.js'

// Stable, injectable IDs (random for real use, deterministic for tests/replay).
export { randomIdGen, deterministicIdGen } from './id.js'
export type { IdGen } from './id.js'

// The typed graph (primary refines tree + typed cross-links) and its invariants.
export { RequirementGraph, GraphError } from './graph.js'
export type { AddNodeInput, GraphErrorCode } from './graph.js'

// Lifecycle state machine.
export { canTransition, allowedTransitions, assertTransition, LifecycleError } from './lifecycle.js'

// Provenance (anti-fabrication) — the single enforcement point.
export {
  isProvenanceLegal,
  assertProvenance,
  isConfirmedSource,
  DEFAULT_LLM_SOURCE,
  ProvenanceError,
} from './provenance.js'

// Refinement obligations (the core contribution): detector classes + deterministic mechanical detection.
export {
  ObligationEngine,
  ObligationError,
  OBLIGATION_KINDS,
} from './obligations.js'
export type { ObligationKind, DischargeHow, DecisionRef, DetectResult, ObligationEngineOptions } from './obligations.js'

// Decisions + propagation (withdrawal re-opens dependents; never silently re-approves).
export { DecisionStore, DecisionError, computeImpactSet } from './decisions.js'
export type { NewDecision, PropagationResult, DecisionEventSink, DecisionStoreOptions } from './decisions.js'

// Cost-aware clarification selection (hypothesis under test, RQ3).
export {
  selectNext,
  rankCandidates,
  scoreCandidate,
  computeBenefit,
  computeCost,
  isBlockingPrerequisite,
  DEFAULT_WEIGHTS,
} from './selector.js'
export type { SelectorWeights, SelectionContext, ScoredCandidate, BenefitBreakdown } from './selector.js'

// Readiness assessment (the explicit stop mechanism).
export { ReadinessAssessor } from './readiness.js'
export type { ReadinessScope, ReadinessInput } from './readiness.js'

// Serialization, schema versioning, migration (additive, crash-recovery safe).
export {
  toDocument,
  fromDocument,
  migrateToLatest,
  preserveExtensions,
  isValidNode,
  isValidEdge,
  SerializationError,
  SCHEMA_VERSION,
} from './serialize.js'
export type { RequirementDocument, RequirementState, LoadOptions } from './serialize.js'

// Append-only replayable event log.
export { EventLog } from './events.js'
export type { TimedEvent } from './events.js'

// RefinementSession — the requirement-layer typed domain tools + turn orchestration (P4, task book §6).
// Headless and deterministic: the Studio agent and the experiment harness consume it as thin wrappers.
export { RefinementSession } from './session.js'
export type {
  DecisionAnswer,
  DecisionAnswerKind,
  ClarificationOutcome,
  DecisionEffect,
  RevisionProposal,
  ApplyRevisionResult,
  TurnResult,
  SessionOptions,
} from './session.js'
