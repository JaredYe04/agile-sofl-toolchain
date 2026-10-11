import { logAuditEvent } from './log'
import {
  LABEL_NO_DECISIONS_REGISTERED,
  type CommitmentClass,
  type DecisionAuditEvent,
  type DecisionAuditKind,
  type DecisionLedger,
  type DecisionStatus,
  type ElementReview,
  type ImpactLink,
  type LinkAcceptance,
  type LinkProvenance,
  type RequirementDecision,
  type ReviewMark
} from './types'

const KNOWN_TOP = new Set(['schemaVersion', 'registration', 'unreadableReason', 'decisions', 'links', 'elements', 'audit', 'preserved'])

export function nowIso(now?: string): string {
  return now ?? new Date().toISOString()
}

export function newDasrId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function cloneLedger(ledger: DecisionLedger): DecisionLedger {
  return JSON.parse(JSON.stringify(ledger)) as DecisionLedger
}

export function emptyLedger(): DecisionLedger {
  return {
    schemaVersion: 1,
    registration: 'empty',
    decisions: [],
    links: [],
    elements: [],
    audit: []
  }
}

export function unreadableLedger(reason: string): DecisionLedger {
  return { ...emptyLedger(), registration: 'unreadable', unreadableReason: reason }
}

/** Empty (no decision records) is "no decisions registered", never "no unresolved decisions". */
export function registrationLabel(ledger: DecisionLedger): string {
  if (ledger.registration === 'unreadable') return 'decision ledger unreadable'
  if (ledger.decisions.length === 0) return LABEL_NO_DECISIONS_REGISTERED
  const n = ledger.decisions.filter((d) => d.status === 'unresolved').length
  if (n === 0) return 'all registered decisions are resolved'
  return n === 1 ? '1 unresolved decision' : `${n} unresolved decisions`
}

export function formatDecisionDigest(ledger: DecisionLedger): string {
  const lines = [
    `Decision ledger: ${registrationLabel(ledger)}.`,
    'Tracked requirement decisions are separate from open refinement obligations. Closing refinement obligations is not decision completion and is not semantic correctness. This ledger does not claim every underspecified requirement was found.'
  ]
  for (const el of ledger.elements) {
    const marks = el.reviewMarks.length ? ` review=${el.reviewMarks.join('+')}` : ''
    if (el.commitment === 'provisional') {
      lines.push(
        `element ${el.elementId}: PROVISIONAL commitment (not a confirmed specification).${marks} decisions=${el.decisionIds.join(',')}`
      )
    } else if (el.commitment === 'override') {
      lines.push(
        `element ${el.elementId}: override commitment (explicit human exception, not a silent confirmed write).${marks} decisions=${el.decisionIds.join(',')}`
      )
    } else if (el.reviewMarks.length) {
      lines.push(
        `element ${el.elementId}: review mark ${el.reviewMarks.join('+')} (not a decision status). decisions=${el.decisionIds.join(',')}`
      )
    } else if (el.commitment === 'confirmed') {
      lines.push(`element ${el.elementId}: confirmed commitment. decisions=${el.decisionIds.join(',')}`)
    }
  }
  return lines.join('\n')
}

export function decisionCompletion(ledger: DecisionLedger): {
  registrationLabel: string
  unresolvedCount: number
  allTrackedConfirmed: boolean
  semanticCorrectness: false
  refinementObligationsClosed: null
} {
  const unresolvedCount = ledger.decisions.filter((d) => d.status === 'unresolved').length
  const live = ledger.decisions.filter((d) => d.status === 'confirmed' || d.status === 'unresolved')
  const allTrackedConfirmed =
    ledger.registration === 'registered' &&
    live.length > 0 &&
    live.every((d) => d.status === 'confirmed')
  return {
    registrationLabel: registrationLabel(ledger),
    unresolvedCount,
    allTrackedConfirmed,
    semanticCorrectness: false,
    refinementObligationsClosed: null
  }
}

function pushAudit(ledger: DecisionLedger, event: Omit<DecisionAuditEvent, 'id' | 'elementIds'> & { elementIds?: string[] }): DecisionAuditEvent {
  const full: DecisionAuditEvent = {
    id: newDasrId('aud'),
    elementIds: event.elementIds ?? [],
    ...event
  }
  ledger.audit.push(full)
  logAuditEvent(full)
  return full
}

function ensureRegistered(ledger: DecisionLedger): void {
  if (ledger.registration === 'unreadable') return
  ledger.registration = 'registered'
}

export function activeLinks(ledger: DecisionLedger, decisionId: string): ImpactLink[] {
  return ledger.links.filter((l) => l.decisionId === decisionId && l.acceptance !== 'rejected')
}

export function unresolvedDecisions(ledger: DecisionLedger): RequirementDecision[] {
  return ledger.decisions.filter((d) => d.status === 'unresolved')
}

/** Unresolved decisions with no proposed or accepted link. Their impact scope is unknown. */
export function unknownScopeDecisions(ledger: DecisionLedger): RequirementDecision[] {
  return unresolvedDecisions(ledger).filter((d) => activeLinks(ledger, d.id).length === 0)
}

export interface RegisterDecisionInput {
  id?: string
  sourceRequirementIds?: string[]
  question: string
  alternatives?: Array<{ id: string; label: string }>
  elementIds?: string[] | null
  provenance?: LinkProvenance
  acceptance?: LinkAcceptance
  now?: string
}

export function registerDecision(
  ledger: DecisionLedger,
  input: RegisterDecisionInput
): { ledger: DecisionLedger; decision?: RequirementDecision; error?: string } {
  if (ledger.registration === 'unreadable') {
    return { ledger, error: ledger.unreadableReason || 'Decision ledger is unreadable. Refusing to overwrite it.' }
  }
  const question = input.question?.trim()
  if (!question) return { ledger, error: 'A decision needs a question.' }
  const next = cloneLedger(ledger)
  ensureRegistered(next)
  const at = nowIso(input.now)
  const decision: RequirementDecision = {
    id: input.id?.trim() || newDasrId('dec'),
    sourceRequirementIds: (input.sourceRequirementIds ?? []).map((id) => id.trim()).filter(Boolean),
    question,
    alternatives: (input.alternatives ?? []).map((a) => ({ id: String(a.id), label: String(a.label) })),
    status: 'unresolved',
    createdAt: at,
    updatedAt: at,
    revision: 1
  }
  if (next.decisions.some((d) => d.id === decision.id)) {
    return { ledger, error: `Decision ${decision.id} already exists.` }
  }
  next.decisions.push(decision)
  pushAudit(next, {
    at,
    kind: 'decision-created',
    decisionId: decision.id,
    toStatus: 'unresolved',
    note: 'Registered an unresolved requirement decision. This does not claim every underspecified requirement was found.'
  })
  const provenance = input.provenance ?? 'human'
  const acceptance = input.acceptance ?? (provenance === 'human' ? 'accepted' : 'proposed')
  if (input.elementIds && input.elementIds.length) {
    for (const elementId of input.elementIds) {
      const id = elementId.trim()
      if (!id) continue
      addLink(next, { decisionId: decision.id, elementId: id, provenance, acceptance, at })
    }
  } else {
    pushAudit(next, {
      at,
      kind: 'impact-linked',
      decisionId: decision.id,
      note: 'No impact links were declared. The decision scope is unknown, so confirmed writes cannot be classified as unrelated.'
    })
  }
  return { ledger: next, decision }
}

function addLink(
  ledger: DecisionLedger,
  input: { decisionId: string; elementId: string; provenance: LinkProvenance; acceptance: LinkAcceptance; at: string; copiedFrom?: string }
): ImpactLink {
  const link: ImpactLink = {
    id: newDasrId('lnk'),
    decisionId: input.decisionId,
    elementId: input.elementId,
    provenance: input.provenance,
    acceptance: input.acceptance,
    copiedFrom: input.copiedFrom,
    createdAt: input.at,
    updatedAt: input.at
  }
  ledger.links.push(link)
  pushAudit(ledger, {
    at: input.at,
    kind: 'impact-linked',
    decisionId: input.decisionId,
    elementIds: [input.elementId],
    note: `Impact link ${link.id} provenance=${input.provenance} acceptance=${input.acceptance}.`
  })
  return link
}

const TRANSITIONS: Record<DecisionStatus, DecisionStatus[]> = {
  unresolved: ['confirmed', 'rejected'],
  confirmed: ['superseded'],
  rejected: ['superseded'],
  superseded: []
}

export function transitionDecision(
  ledger: DecisionLedger,
  input: {
    id: string
    to: DecisionStatus
    actorRole?: string
    evidence?: string
    selectedAlternativeId?: string
    now?: string
    note?: string
  }
): { ledger: DecisionLedger; error?: string } {
  if (ledger.registration === 'unreadable') return { ledger, error: 'Decision ledger is unreadable.' }
  const next = cloneLedger(ledger)
  const decision = next.decisions.find((d) => d.id === input.id)
  if (!decision) return { ledger, error: `No decision ${input.id}.` }
  if (input.to === 'unresolved') {
    return {
      ledger,
      error: `Refusing to set ${decision.id} back to unresolved. Reopen by superseding it and creating a successor.`
    }
  }
  if (!TRANSITIONS[decision.status].includes(input.to)) {
    return { ledger, error: `Cannot move ${decision.id} from ${decision.status} to ${input.to}.` }
  }
  if ((input.to === 'confirmed' || input.to === 'rejected') && !input.actorRole?.trim()) {
    return { ledger, error: 'Confirmation or rejection needs an actor role. The model cannot do this by itself.' }
  }
  if (input.to === 'confirmed' && decision.alternatives.length > 0) {
    const selected = input.selectedAlternativeId?.trim()
    if (!selected || !decision.alternatives.some((a) => a.id === selected)) {
      return { ledger, error: 'Confirmation must name one of the recorded alternatives.' }
    }
    decision.selectedAlternativeId = selected
  }
  const from = decision.status
  const at = nowIso(input.now)
  decision.status = input.to
  decision.updatedAt = at
  decision.revision += 1
  if (input.to === 'confirmed' || input.to === 'rejected') {
    decision.confirmedBy = input.actorRole!.trim()
    decision.confirmationEvidence = input.evidence?.trim() || undefined
  }
  pushAudit(next, {
    at,
    kind: 'status-transition',
    decisionId: decision.id,
    fromStatus: from,
    toStatus: input.to,
    elementIds: activeLinks(next, decision.id).map((l) => l.elementId),
    actorRole: input.actorRole?.trim(),
    note: input.note || `${from} -> ${input.to}`
  })
  return { ledger: next }
}

export function confirmDecision(
  ledger: DecisionLedger,
  input: { id: string; actorRole: string; evidence?: string; selectedAlternativeId?: string; now?: string }
): { ledger: DecisionLedger; error?: string } {
  return transitionDecision(ledger, { ...input, to: 'confirmed', note: 'Human confirmed the decision.' })
}

export function rejectDecision(
  ledger: DecisionLedger,
  input: { id: string; actorRole: string; evidence?: string; now?: string }
): { ledger: DecisionLedger; error?: string } {
  return transitionDecision(ledger, { ...input, to: 'rejected', note: 'Human rejected the decision.' })
}

/**
 * Reopen = supersede the predecessor and append a new unresolved successor.
 * The predecessor's status, selected alternative, and links stay in the ledger.
 */
export function reopenDecision(
  ledger: DecisionLedger,
  input: { id: string; actorRole?: string; reason?: string; now?: string }
): { ledger: DecisionLedger; successor?: RequirementDecision; error?: string } {
  const predecessor = ledger.decisions.find((d) => d.id === input.id)
  if (!predecessor) return { ledger, error: `No decision ${input.id}.` }
  if (predecessor.status === 'unresolved') {
    return { ledger, error: `${predecessor.id} is already unresolved. Reopen applies to a confirmed or rejected decision.` }
  }
  if (predecessor.status === 'superseded') {
    return { ledger, error: `${predecessor.id} is already superseded. Create another successor explicitly if needed.` }
  }
  const moved = transitionDecision(ledger, {
    id: predecessor.id,
    to: 'superseded',
    actorRole: input.actorRole,
    now: input.now,
    note: input.reason || 'Superseded so a successor can be registered. The previous choice is kept.'
  })
  if (moved.error || !moved.ledger) return { ledger, error: moved.error }
  const at = nowIso(input.now)
  const next = moved.ledger
  const old = next.decisions.find((d) => d.id === predecessor.id)!
  const successor: RequirementDecision = {
    id: newDasrId('dec'),
    sourceRequirementIds: [...old.sourceRequirementIds],
    question: old.question,
    alternatives: old.alternatives.map((a) => ({ ...a })),
    status: 'unresolved',
    successorOf: old.id,
    createdAt: at,
    updatedAt: at,
    revision: 1
  }
  old.supersededBy = successor.id
  next.decisions.push(successor)
  pushAudit(next, {
    at,
    kind: 'decision-created',
    decisionId: successor.id,
    toStatus: 'unresolved',
    note: `Successor of superseded ${old.id}. Previous confirmation was not overwritten.`
  })
  for (const link of next.links.filter((l) => l.decisionId === old.id && l.acceptance !== 'rejected')) {
    addLink(next, {
      decisionId: successor.id,
      elementId: link.elementId,
      provenance: link.provenance,
      acceptance: link.acceptance,
      at,
      copiedFrom: link.id
    })
  }
  return { ledger: next, successor }
}

export function setLinkAcceptance(
  ledger: DecisionLedger,
  input: { linkId: string; acceptance: 'accepted' | 'rejected'; actorRole: string; now?: string }
): { ledger: DecisionLedger; error?: string } {
  if (!input.actorRole?.trim()) return { ledger, error: 'Accepting or rejecting a link needs an actor role.' }
  const next = cloneLedger(ledger)
  const link = next.links.find((l) => l.id === input.linkId)
  if (!link) return { ledger, error: `No impact link ${input.linkId}.` }
  const at = nowIso(input.now)
  link.acceptance = input.acceptance
  link.updatedAt = at
  const kind: DecisionAuditKind = input.acceptance === 'accepted' ? 'impact-accepted' : 'impact-rejected'
  pushAudit(next, {
    at,
    kind,
    decisionId: link.decisionId,
    elementIds: [link.elementId],
    actorRole: input.actorRole.trim(),
    note: `Link ${link.id} acceptance=${input.acceptance}. Provenance remains ${link.provenance}.`
  })
  return { ledger: next }
}

function upsertReview(
  ledger: DecisionLedger,
  elementId: string,
  patch: { commitment?: CommitmentClass | null; addMarks?: ReviewMark[]; clearMarks?: boolean; reason: string; decisionIds?: string[]; at: string }
): void {
  let row = ledger.elements.find((e) => e.elementId === elementId)
  if (!row) {
    row = {
      elementId,
      commitment: null,
      reviewMarks: [],
      reason: '',
      decisionIds: [],
      updatedAt: patch.at
    }
    ledger.elements.push(row)
  }
  if (patch.commitment !== undefined) row.commitment = patch.commitment
  if (patch.clearMarks) row.reviewMarks = []
  if (patch.addMarks) {
    for (const mark of patch.addMarks) {
      if (!row.reviewMarks.includes(mark)) row.reviewMarks.push(mark)
    }
  }
  if (patch.decisionIds) {
    for (const id of patch.decisionIds) {
      if (!row.decisionIds.includes(id)) row.decisionIds.push(id)
    }
  }
  row.reason = patch.reason
  row.updatedAt = patch.at
}

export function markElementsForReview(
  ledger: DecisionLedger,
  input: { elementIds: string[]; decisionIds: string[]; reason: string; now?: string }
): DecisionLedger {
  const next = cloneLedger(ledger)
  const at = nowIso(input.now)
  const ids = [...new Set(input.elementIds)]
  for (const elementId of ids) {
    upsertReview(next, elementId, {
      addMarks: ['stale', 'needs-review'],
      reason: input.reason,
      decisionIds: input.decisionIds,
      at
    })
  }
  if (ids.length) {
    pushAudit(next, {
      at,
      kind: 'review-marked',
      decisionId: input.decisionIds[0],
      elementIds: ids,
      note: input.reason
    })
  }
  return next
}

/** Reading an element records the read and does not clear stale or needs-review. */
export function recordElementRead(
  ledger: DecisionLedger,
  input: { elementId: string; now?: string }
): DecisionLedger {
  const before = JSON.stringify(ledger.elements)
  const next = cloneLedger(ledger)
  const at = nowIso(input.now)
  pushAudit(next, {
    at,
    kind: 'element-read',
    elementIds: [input.elementId],
    note: 'Read. Review marks were not cleared.'
  })
  if (JSON.stringify(next.elements) !== before) {
    throw new Error('element read mutated review state')
  }
  return next
}

export function acknowledgeReview(
  ledger: DecisionLedger,
  input: { elementId: string; actorRole: string; evidence?: string; now?: string }
): { ledger: DecisionLedger; error?: string } {
  if (!input.actorRole?.trim()) return { ledger, error: 'Clearing a review mark needs an actor role.' }
  const next = cloneLedger(ledger)
  const row = next.elements.find((e) => e.elementId === input.elementId)
  if (!row || row.reviewMarks.length === 0) {
    return { ledger, error: `Element ${input.elementId} has no stale or needs-review mark.` }
  }
  const at = nowIso(input.now)
  row.reviewMarks = []
  row.reason = input.evidence?.trim() || `Review acknowledged by ${input.actorRole.trim()}.`
  row.updatedAt = at
  pushAudit(next, {
    at,
    kind: 'review-acknowledged',
    elementIds: [input.elementId],
    actorRole: input.actorRole.trim(),
    note: row.reason
  })
  return { ledger: next }
}

export function applyUpstreamChange(
  ledger: DecisionLedger,
  input: { requirementId: string; actorRole?: string; reason?: string; now?: string }
): { ledger: DecisionLedger; superseded: string[]; successors: string[]; untouched: string[]; unknownImpact: string[] } {
  const requirementId = input.requirementId.trim()
  let next = cloneLedger(ledger)
  const superseded: string[] = []
  const successors: string[] = []
  const unknownImpact: string[] = []
  const touched = new Set<string>()
  const reason = input.reason || `Upstream requirement ${requirementId} changed.`
  for (const decision of [...next.decisions]) {
    if (!decision.sourceRequirementIds.includes(requirementId)) continue
    if (decision.status === 'superseded') continue
    touched.add(decision.id)
    const links = activeLinks(next, decision.id)
    if (links.length === 0) unknownImpact.push(decision.id)
    if (decision.status === 'confirmed' || decision.status === 'rejected') {
      const reopened = reopenDecision(next, {
        id: decision.id,
        actorRole: input.actorRole,
        reason,
        now: input.now
      })
      next = reopened.ledger
      superseded.push(decision.id)
      if (reopened.successor) successors.push(reopened.successor.id)
    }
    const elementIds = links.map((l) => l.elementId)
    if (elementIds.length) {
      next = markElementsForReview(next, {
        elementIds,
        decisionIds: [decision.id],
        reason: `${reason} Downstream elements need review. Reading them does not clear this mark.`,
        now: input.now
      })
    } else {
      const at = nowIso(input.now)
      pushAudit(next, {
        at,
        kind: 'review-marked',
        decisionId: decision.id,
        note: `${reason} Impact links are unknown, so no element was marked. This is a limitation, not a claim that nothing is affected.`
      })
    }
  }
  const untouched = next.decisions.map((d) => d.id).filter((id) => !touched.has(id) && !successors.includes(id))
  return { ledger: next, superseded, successors, untouched, unknownImpact }
}

export function recordCommitment(
  ledger: DecisionLedger,
  input: {
    elementIds: string[]
    decisionIds: string[]
    commitment: CommitmentClass
    writePath: string
    proposalId?: string
    actorRole?: string
    note: string
    now?: string
    kind: 'write-allowed' | 'write-provisional' | 'write-override' | 'write-blocked'
  }
): DecisionLedger {
  const next = cloneLedger(ledger)
  if (next.registration !== 'registered') return next
  const at = nowIso(input.now)
  if (input.kind !== 'write-blocked') {
    for (const elementId of input.elementIds) {
      upsertReview(next, elementId, {
        commitment: input.commitment,
        reason: input.note,
        decisionIds: input.decisionIds,
        at
      })
    }
  }
  pushAudit(next, {
    at,
    kind: input.kind,
    decisionId: input.decisionIds[0],
    elementIds: input.elementIds,
    commitment: input.commitment,
    actorRole: input.actorRole,
    note: input.note,
    proposalId: input.proposalId,
    writePath: input.writePath
  })
  return next
}

function isStatus(value: unknown): value is DecisionStatus {
  return value === 'unresolved' || value === 'confirmed' || value === 'rejected' || value === 'superseded'
}

function migrateDecision(raw: unknown, at: string): RequirementDecision | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : newDasrId('dec')
  const question = typeof row.question === 'string' ? row.question : ''
  if (!question.trim()) return null
  const status = isStatus(row.status) ? row.status : 'unresolved'
  const alternatives = Array.isArray(row.alternatives)
    ? row.alternatives
        .map((alt) => {
          if (!alt || typeof alt !== 'object') return null
          const a = alt as Record<string, unknown>
          if (typeof a.id !== 'string' || typeof a.label !== 'string') return null
          return { id: a.id, label: a.label }
        })
        .filter((a): a is { id: string; label: string } => Boolean(a))
    : []
  return {
    id,
    sourceRequirementIds: Array.isArray(row.sourceRequirementIds)
      ? row.sourceRequirementIds.filter((id): id is string => typeof id === 'string')
      : [],
    question,
    alternatives,
    status,
    selectedAlternativeId: typeof row.selectedAlternativeId === 'string' ? row.selectedAlternativeId : undefined,
    confirmedBy: typeof row.confirmedBy === 'string' ? row.confirmedBy : undefined,
    confirmationEvidence: typeof row.confirmationEvidence === 'string' ? row.confirmationEvidence : undefined,
    successorOf: typeof row.successorOf === 'string' ? row.successorOf : undefined,
    supersededBy: typeof row.supersededBy === 'string' ? row.supersededBy : undefined,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : at,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : at,
    revision: typeof row.revision === 'number' && Number.isFinite(row.revision) ? row.revision : 1
  }
}

function migrateElement(raw: unknown, at: string): ElementReview | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (typeof row.elementId !== 'string' || !row.elementId.trim()) return null
  const commitment: CommitmentClass | null =
    row.commitment === 'confirmed' || row.commitment === 'provisional' || row.commitment === 'override' ? row.commitment : null
  const reviewMarks = Array.isArray(row.reviewMarks)
    ? row.reviewMarks.filter((mark): mark is ReviewMark => mark === 'stale' || mark === 'needs-review')
    : []
  return {
    elementId: row.elementId,
    commitment,
    reviewMarks,
    reason: typeof row.reason === 'string' ? row.reason : '',
    decisionIds: Array.isArray(row.decisionIds) ? row.decisionIds.filter((id): id is string => typeof id === 'string') : [],
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : at
  }
}

function migrateLink(raw: unknown, at: string): ImpactLink | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (typeof row.decisionId !== 'string' || typeof row.elementId !== 'string') return null
  const provenance: LinkProvenance =
    row.provenance === 'human' || row.provenance === 'model' || row.provenance === 'system' || row.provenance === 'import'
      ? row.provenance
      : 'import'
  const acceptance: LinkAcceptance =
    row.acceptance === 'accepted' || row.acceptance === 'proposed' || row.acceptance === 'rejected' ? row.acceptance : 'proposed'
  return {
    id: typeof row.id === 'string' ? row.id : newDasrId('lnk'),
    decisionId: row.decisionId,
    elementId: row.elementId,
    provenance,
    acceptance,
    copiedFrom: typeof row.copiedFrom === 'string' ? row.copiedFrom : undefined,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : at,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : at
  }
}

/** Load a ledger object from JSON. Missing decisions become an empty ledger, not a claim of resolution. */
export function ledgerFromJson(raw: unknown): DecisionLedger {
  const at = nowIso()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return unreadableLedger('Decision ledger JSON is not an object. Refusing to treat it as empty.')
  }
  const body = raw as Record<string, unknown>
  if ('decisions' in body && !Array.isArray(body.decisions)) {
    return unreadableLedger('Decision ledger field decisions is malformed. Refusing to treat it as no decisions.')
  }
  const decisions = (Array.isArray(body.decisions) ? body.decisions : [])
    .map((row) => migrateDecision(row, at))
    .filter((d): d is RequirementDecision => Boolean(d))
  const links = (Array.isArray(body.links) ? body.links : [])
    .map((row) => migrateLink(row, at))
    .filter((l): l is ImpactLink => Boolean(l))
  const elements = (Array.isArray(body.elements) ? body.elements : [])
    .map((row) => migrateElement(row, at))
    .filter((el): el is ElementReview => Boolean(el))
  if (Array.isArray(body.decisions)) {
    for (const row of body.decisions) {
      if (!row || typeof row !== 'object') continue
      const decision = row as Record<string, unknown>
      const decisionId = typeof decision.id === 'string' ? decision.id : ''
      const legacy = decision.affectedElementIds
      if (!decisionId || !Array.isArray(legacy)) continue
      for (const elementId of legacy) {
        if (typeof elementId !== 'string' || !elementId.trim()) continue
        if (links.some((l) => l.decisionId === decisionId && l.elementId === elementId)) continue
        links.push({
          id: newDasrId('lnk'),
          decisionId,
          elementId,
          provenance: 'import',
          acceptance: 'proposed',
          createdAt: at,
          updatedAt: at
        })
      }
    }
  }
  const preserved: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (!KNOWN_TOP.has(key)) preserved[key] = value
  }
  const ledger: DecisionLedger = {
    schemaVersion: 1,
    registration: decisions.length || links.length || elements.length || body.registration === 'registered' ? 'registered' : 'empty',
    decisions,
    links,
    elements,
    audit: Array.isArray(body.audit) ? (body.audit as DecisionAuditEvent[]) : [],
    preserved: Object.keys(preserved).length ? preserved : undefined
  }
  if (body.registration === 'registered') ledger.registration = 'registered'
  if (decisions.length === 0 && links.length === 0 && elements.length === 0 && body.registration !== 'registered') {
    ledger.registration = 'empty'
  }
  return ledger
}
