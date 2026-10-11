/**
 * Decision-Aware Specification Refinement (DASR) records.
 *
 * Decision status is only unresolved | confirmed | rejected | superseded.
 * Reopening a resolved decision is not an in-place status change: the predecessor
 * becomes superseded and a new unresolved successor is appended.
 *
 * Stale / needs-review are review marks on specification elements, not decision statuses.
 * confirmed / provisional / override are commitment classes of a write, not decision statuses.
 *
 * This module does not describe refinement-obligation counters, and it does not
 * claim that every underspecified requirement has been found.
 */

export const DECISION_STATUSES = ['unresolved', 'confirmed', 'rejected', 'superseded'] as const
export type DecisionStatus = (typeof DECISION_STATUSES)[number]

export const COMMITMENT_CLASSES = ['confirmed', 'provisional', 'override'] as const
export type CommitmentClass = (typeof COMMITMENT_CLASSES)[number]

export const REVIEW_MARKS = ['stale', 'needs-review'] as const
export type ReviewMark = (typeof REVIEW_MARKS)[number]

export const LINK_PROVENANCE = ['human', 'model', 'system', 'import'] as const
export type LinkProvenance = (typeof LINK_PROVENANCE)[number]

export const LINK_ACCEPTANCE = ['proposed', 'accepted', 'rejected'] as const
export type LinkAcceptance = (typeof LINK_ACCEPTANCE)[number]

export const LABEL_NO_DECISIONS_REGISTERED = 'no decisions registered'

export interface DecisionAlternative {
  id: string
  label: string
}

export interface RequirementDecision {
  id: string
  sourceRequirementIds: string[]
  question: string
  alternatives: DecisionAlternative[]
  status: DecisionStatus
  selectedAlternativeId?: string
  confirmedBy?: string
  confirmationEvidence?: string
  /** Set on the new unresolved record created when a predecessor is reopened. */
  successorOf?: string
  /** Set on the predecessor when a successor is created. */
  supersededBy?: string
  createdAt: string
  updatedAt: string
  revision: number
}

/** Decision-to-element impact link. Provenance and acceptance are both required. */
export interface ImpactLink {
  id: string
  decisionId: string
  elementId: string
  provenance: LinkProvenance
  acceptance: LinkAcceptance
  copiedFrom?: string
  createdAt: string
  updatedAt: string
}

/** Review state of a tracked element. Review marks are not decision statuses. */
export interface ElementReview {
  elementId: string
  commitment: CommitmentClass | null
  reviewMarks: ReviewMark[]
  reason: string
  decisionIds: string[]
  updatedAt: string
}

export type DecisionAuditKind =
  | 'decision-created'
  | 'status-transition'
  | 'impact-linked'
  | 'impact-accepted'
  | 'impact-rejected'
  | 'write-blocked'
  | 'write-allowed'
  | 'write-provisional'
  | 'write-override'
  | 'review-marked'
  | 'review-acknowledged'
  | 'element-read'

export interface DecisionAuditEvent {
  id: string
  at: string
  kind: DecisionAuditKind
  decisionId?: string
  fromStatus?: DecisionStatus
  toStatus?: DecisionStatus
  elementIds: string[]
  commitment?: CommitmentClass
  actorRole?: string
  note: string
  proposalId?: string
  writePath?: string
}

/** `empty` is a missing or decision-free ledger. It is not "no unresolved decisions". */
export type LedgerRegistration = 'empty' | 'registered' | 'unreadable'

export interface DecisionLedger {
  schemaVersion: 1
  registration: LedgerRegistration
  unreadableReason?: string
  decisions: RequirementDecision[]
  links: ImpactLink[]
  elements: ElementReview[]
  audit: DecisionAuditEvent[]
  /** Fields from older files that this version does not interpret. */
  preserved?: Record<string, unknown>
}

export type ImpactDeclaration =
  | { kind: 'elements'; ids: string[]; asserted?: boolean }
  | { kind: 'unknown' }
  | { kind: 'missing' }
  | { kind: 'malformed' }

export type GateDisposition =
  | 'skipped-dasr-off'
  | 'allowed'
  | 'blocked'
  | 'provisional'
  | 'override'

export interface GateOverride {
  role: string
  reason: string
}

export interface GateRequest {
  dasrEnabled: boolean
  ledger: DecisionLedger
  impact: ImpactDeclaration
  commitment: CommitmentClass
  writePath: string
  proposalId?: string
  override?: GateOverride
  now?: string
}

export interface GateResult {
  allow: boolean
  disposition: GateDisposition
  error?: string
  /** Unresolved decisions that made a confirmed write illegal, or that a legal write relied on. */
  decisionIds: string[]
  elementIds: string[]
  requiresHuman: boolean
  ledger: DecisionLedger
}
