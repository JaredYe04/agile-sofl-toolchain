import type { InformalPatchPayload } from '../../src/main/services/llm/agentTypes'
import { thinkingMsAt } from './timing'
import type { AgentModel, ProposalDecision } from './types'

export function patchChars(patch: Pick<InformalPatchPayload, 'explanation' | 'operations'>): number {
  return JSON.stringify({ explanation: patch.explanation ?? '', operations: patch.operations ?? [] }).length
}

function clamp01(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/**
 * Interpret one agent model against one pending proposal.
 * `rng` must return two uniforms: the thinking-time draw, then the accept/reject draw.
 */
export function decideProposal(model: AgentModel, patch: InformalPatchPayload, rng: () => number): ProposalDecision {
  const ops = patch.operations ?? []
  const reasons: string[] = []
  let risk = ops.length * model.penalties.perOp
  if (ops.length >= model.penalties.largePatchOps) {
    risk += model.penalties.largePatch
    reasons.push('large-patch')
  }
  const removes = ops.filter((op) => {
    const kind = String(op.op || op.action || '')
    return kind === 'remove' || kind === 'remove-screen' || kind === 'remove-node' || kind === 'remove-widget'
  }).length
  if (removes > 0) {
    risk += removes * model.penalties.removeOp
    reasons.push('remove')
  }
  const source =
    patch.mode === 'source' ||
    ops.some((op) => {
      const kind = String(op.op || '')
      return kind === 'replace' || kind === 'replace-document' || kind === 'append'
    })
  if (source) {
    risk += model.penalties.sourceEdit
    reasons.push('source-edit')
  }
  if (ops.some((op) => op.op === 'refine-step')) {
    risk += model.penalties.refineStep
    reasons.push('refine-step')
  }
  risk = Math.min(1, Math.max(0, risk))
  const acceptProbability = clamp01(model.acceptPropensity - model.riskAversion * risk, 0.08, 0.97)
  const thinkingMs = thinkingMsAt(model.proposalThink, patchChars(patch), rng())
  const draw = rng()
  const decision = draw < acceptProbability ? 'accept' : 'reject'
  if (decision === 'reject' && reasons.length === 0) reasons.push('propensity')
  return { decision, acceptProbability, risk, reasons, thinkingMs, draw }
}
