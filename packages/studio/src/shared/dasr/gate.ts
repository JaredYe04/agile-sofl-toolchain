import {
  activeLinks,
  recordCommitment,
  unknownScopeDecisions,
  unresolvedDecisions
} from './ledger'
import type { CommitmentClass, DecisionLedger, GateRequest, GateResult, ImpactDeclaration } from './types'

/**
 * Decision gate.
 *
 * Runs whenever DASR is enabled, including auto-write. Auto-write skips only the
 * human Apply click. It does not skip this predicate.
 *
 * Missing, unknown, or malformed target sets fail closed. They are not treated as
 * "no affected elements".
 *
 * An unresolved decision with no proposed or accepted impact link has unknown scope
 * and also fails closed: a named target cannot be classified as unrelated.
 * Withdrawn links are not active. This stricter rule is intentional.
 *
 * Override is a human commitment. It is refused when automaticMode is set
 * (UI auto-write or harness auto-approve), even if a role and reason are present.
 */

function blocked(
  ledger: DecisionLedger,
  input: {
    error: string
    decisionIds: string[]
    elementIds: string[]
    writePath: string
    proposalId?: string
    commitment: CommitmentClass
    now?: string
    requiresHuman?: boolean
  }
): GateResult {
  const next =
    ledger.registration === 'registered'
      ? recordCommitment(ledger, {
          elementIds: input.elementIds,
          decisionIds: input.decisionIds,
          commitment: input.commitment,
          writePath: input.writePath,
          proposalId: input.proposalId,
          note: input.error,
          now: input.now,
          kind: 'write-blocked'
        })
      : ledger
  return {
    allow: false,
    disposition: 'blocked',
    error: input.error,
    decisionIds: input.decisionIds,
    elementIds: input.elementIds,
    requiresHuman: input.requiresHuman ?? true,
    ledger: next
  }
}

function elementIdsOf(impact: ImpactDeclaration): string[] {
  return impact.kind === 'elements' ? [...new Set(impact.ids.map((id) => id.trim()).filter(Boolean))] : []
}

export function evaluateDecisionGate(req: GateRequest): GateResult {
  const commitment = req.commitment
  // An unreadable ledger is not an empty ledger. Fail closed even when the C1 flag
  // would otherwise skip the gate: the file may contain decisions we cannot see.
  if (req.ledger.registration === 'unreadable') {
    return blocked(req.ledger, {
      error: req.ledger.unreadableReason || 'Decision ledger is unreadable. The write is refused.',
      decisionIds: [],
      elementIds: [],
      writePath: req.writePath,
      proposalId: req.proposalId,
      commitment,
      now: req.now
    })
  }
  if (!req.dasrEnabled) {
    return {
      allow: true,
      disposition: 'skipped-dasr-off',
      decisionIds: [],
      elementIds: elementIdsOf(req.impact),
      requiresHuman: false,
      ledger: req.ledger
    }
  }
  if (commitment === 'override' && req.automaticMode) {
    return blocked(req.ledger, {
      error:
        'Override commitment is refused while automatic mode or auto-approve is on. Auto mode skips only the Apply click. A human override needs an actor role and a reason outside automatic mode.',
      decisionIds: unresolvedDecisions(req.ledger).map((d) => d.id),
      elementIds: elementIdsOf(req.impact),
      writePath: req.writePath,
      proposalId: req.proposalId,
      commitment,
      now: req.now
    })
  }
  const impact = req.impact
  if (impact.kind === 'missing' || impact.kind === 'unknown' || impact.kind === 'malformed') {
    return blocked(req.ledger, {
      error:
        'Target elements are missing or unknown. The decision gate fails closed and will not treat that as no impact. Name the tracked element ids, or record an explicit human judgment.',
      decisionIds: unresolvedDecisions(req.ledger).map((d) => d.id),
      elementIds: [],
      writePath: req.writePath,
      proposalId: req.proposalId,
      commitment,
      now: req.now
    })
  }
  const ids = elementIdsOf(impact)
  if (ids.length === 0 && !impact.asserted) {
    return blocked(req.ledger, {
      error:
        'An empty target list is not evidence of no impact. The decision gate fails closed. Assert the empty set only as an explicit human judgment, or name the elements.',
      decisionIds: unresolvedDecisions(req.ledger).map((d) => d.id),
      elementIds: [],
      writePath: req.writePath,
      proposalId: req.proposalId,
      commitment,
      now: req.now
    })
  }

  const unknown = unknownScopeDecisions(req.ledger)
  if (unknown.length && commitment !== 'override') {
    return blocked(req.ledger, {
      error: `Unresolved decision ${unknown.map((d) => d.id).join(', ')} has no accepted or proposed impact links. Its scope is unknown, so this write cannot be classified as unrelated.`,
      decisionIds: unknown.map((d) => d.id),
      elementIds: ids,
      writePath: req.writePath,
      proposalId: req.proposalId,
      commitment,
      now: req.now
    })
  }

  const hitting = unresolvedDecisions(req.ledger).filter((d) =>
    activeLinks(req.ledger, d.id).some((link) => ids.includes(link.elementId))
  )
  const hitIds = hitting.map((d) => d.id)

  if (commitment === 'override') {
    const role = req.override?.role?.trim()
    const reason = req.override?.reason?.trim()
    if (!role || !reason) {
      return blocked(req.ledger, {
        error: 'Override commitment requires an actor role and a reason. It is not a silent confirmed write.',
        decisionIds: hitIds.length ? hitIds : unknown.map((d) => d.id),
        elementIds: ids,
        writePath: req.writePath,
        proposalId: req.proposalId,
        commitment,
        now: req.now
      })
    }
    const ledger = recordCommitment(req.ledger, {
      elementIds: ids,
      decisionIds: hitIds,
      commitment: 'override',
      writePath: req.writePath,
      proposalId: req.proposalId,
      actorRole: role,
      note: `Human override by ${role}: ${reason}`,
      now: req.now,
      kind: 'write-override'
    })
    return { allow: true, disposition: 'override', decisionIds: hitIds, elementIds: ids, requiresHuman: false, ledger }
  }

  if (hitIds.length && commitment === 'confirmed') {
    return blocked(req.ledger, {
      error: `Confirmed write blocked. Unresolved decisions ${hitIds.join(', ')} still impact ${ids.filter((id) => hitting.some((d) => activeLinks(req.ledger, d.id).some((l) => l.elementId === id))).join(', ') || ids.join(', ')}. Confirm the decision, submit commitment "provisional", or record a human override. propose_source_edit, propose_gui_changes, and auto-write cannot bypass this gate.`,
      decisionIds: hitIds,
      elementIds: ids,
      writePath: req.writePath,
      proposalId: req.proposalId,
      commitment,
      now: req.now
    })
  }

  if (hitIds.length && commitment === 'provisional') {
    const ledger = recordCommitment(req.ledger, {
      elementIds: ids,
      decisionIds: hitIds,
      commitment: 'provisional',
      writePath: req.writePath,
      proposalId: req.proposalId,
      note: `Stored as provisional for unresolved decisions ${hitIds.join(', ')}. This is not a confirmed specification.`,
      now: req.now,
      kind: 'write-provisional'
    })
    return { allow: true, disposition: 'provisional', decisionIds: hitIds, elementIds: ids, requiresHuman: false, ledger }
  }

  const relied = req.ledger.decisions
    .filter((d) => d.status === 'confirmed' && activeLinks(req.ledger, d.id).some((l) => ids.includes(l.elementId)))
    .map((d) => d.id)
  const ledger = recordCommitment(req.ledger, {
    elementIds: ids,
    decisionIds: relied,
    commitment: 'confirmed',
    writePath: req.writePath,
    proposalId: req.proposalId,
    note: relied.length
      ? `Confirmed write allowed after decisions ${relied.join(', ')}.`
      : 'Confirmed write allowed. Declared targets do not intersect an unresolved decision.',
    now: req.now,
    kind: 'write-allowed'
  })
  return { allow: true, disposition: 'allowed', decisionIds: relied, elementIds: ids, requiresHuman: false, ledger }
}
