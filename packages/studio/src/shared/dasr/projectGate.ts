import { resolveDasrMode } from './flag'
import { evaluateDecisionGate } from './gate'
import { commitmentFromUnknown, resolveProposalImpact } from './extract'
import { registerDecision, registrationLabel } from './ledger'
import { readDasrFileConfig, readDecisionLedger, writeDecisionLedger } from './store'
import type { CommitmentClass, GateResult, ImpactDeclaration } from './types'

export function guardProjectWrite(
  projectRoot: string | undefined,
  input: {
    writePath: string
    impact: ImpactDeclaration
    commitment?: CommitmentClass
    proposalId?: string
    now?: string
    env?: NodeJS.ProcessEnv
  }
): GateResult {
  const flag = resolveDasrMode({ env: input.env ?? process.env, file: readDasrFileConfig(projectRoot) })
  const ledger = readDecisionLedger(projectRoot)
  const result = evaluateDecisionGate({
    dasrEnabled: flag.enabled,
    ledger,
    impact: input.impact,
    commitment: input.commitment ?? 'confirmed',
    writePath: input.writePath,
    proposalId: input.proposalId,
    now: input.now
  })
  if (projectRoot && result.ledger !== ledger && result.ledger.registration === 'registered') {
    writeDecisionLedger(projectRoot, result.ledger)
  }
  return result
}

/**
 * Proposal screen used by the agent loop. Override fields on the model payload are ignored.
 * The model cannot grant itself an override.
 */
export function gateAgentProposal(
  projectRoot: string | undefined,
  input: {
    tool: string
    args: Record<string, unknown>
    operations: Array<Record<string, unknown>>
    proposalId?: string
    env?: NodeJS.ProcessEnv
  }
): GateResult {
  const impact = resolveProposalImpact({
    operations: input.operations,
    impactElementIds: input.args.impactElementIds,
    impactUnknown: input.args.impactUnknown
  })
  return guardProjectWrite(projectRoot, {
    writePath: input.tool,
    impact,
    commitment: commitmentFromUnknown(input.args.commitment),
    proposalId: input.proposalId,
    env: input.env
  })
}

export function handleDasrTool(
  projectRoot: string | undefined,
  name: string,
  args: Record<string, unknown>,
  env?: NodeJS.ProcessEnv
): { handled: boolean; ok: boolean; body: Record<string, unknown> } {
  if (name !== 'list_decisions' && name !== 'register_decision') return { handled: false, ok: false, body: {} }
  const flag = resolveDasrMode({ env: env ?? process.env, file: readDasrFileConfig(projectRoot) })
  if (!flag.enabled) {
    return {
      handled: true,
      ok: false,
      body: { error: 'DASR is off (C1). Decision tools are not active.' }
    }
  }
  const ledger = projectRoot ? readDecisionLedger(projectRoot) : readDecisionLedger(undefined)
  if (name === 'list_decisions') {
    return {
      handled: true,
      ok: true,
      body: {
        label: registrationLabel(ledger),
        registration: ledger.registration,
        decisions: ledger.decisions,
        links: ledger.links,
        elements: ledger.elements,
        note: 'These are tracked requirement decisions only. The list is not a discovery of every underspecified requirement, and it is not the refinement-obligation digest.'
      }
    }
  }
  if (args.status !== undefined && args.status !== 'unresolved') {
    return {
      handled: true,
      ok: false,
      body: { error: 'The model cannot confirm, reject, or supersede a decision. A human uses the decision API.' }
    }
  }
  const created = registerDecision(ledger, {
    id: typeof args.id === 'string' ? args.id : undefined,
    question: typeof args.question === 'string' ? args.question : '',
    sourceRequirementIds: Array.isArray(args.sourceRequirementIds)
      ? args.sourceRequirementIds.filter((id): id is string => typeof id === 'string')
      : [],
    alternatives: Array.isArray(args.alternatives)
      ? args.alternatives
          .map((alt) => {
            if (!alt || typeof alt !== 'object') return null
            const row = alt as Record<string, unknown>
            if (typeof row.id !== 'string' || typeof row.label !== 'string') return null
            return { id: row.id, label: row.label }
          })
          .filter((alt): alt is { id: string; label: string } => Boolean(alt))
      : [],
    elementIds: Array.isArray(args.affectedElementIds)
      ? args.affectedElementIds.filter((id): id is string => typeof id === 'string')
      : null,
    provenance: 'model',
    acceptance: 'proposed'
  })
  if (created.error || !created.decision) return { handled: true, ok: false, body: { error: created.error || 'Could not register the decision.' } }
  if (projectRoot) writeDecisionLedger(projectRoot, created.ledger)
  return {
    handled: true,
    ok: true,
    body: {
      decision: created.decision,
      label: registrationLabel(created.ledger),
      note: 'Registered as unresolved. Impact links from this call are proposed, not accepted, until a human accepts them.'
    }
  }
}
