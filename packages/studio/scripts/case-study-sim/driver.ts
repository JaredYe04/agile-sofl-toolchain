import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { runAgentTurn, resumeWithToolResult, type AgentTurnContext } from '../../src/main/services/llm/agentLoop'
import {
  defaultAgentPermissions,
  generationAgentPermissions,
  newId,
  type AgentSession,
  type AgentSpecPermissions
} from '../../src/main/services/llm/agentTypes'
import {
  localIso,
  type ClarificationAsk,
  type ClarificationResolution
} from '../agent-harness/core'
import { applyGuiProposal, applyHybrid, applyInformalProposal } from './apply'
import { phaseUserText, promptExtras } from './briefs'
import { resolveFromFacts } from './oracle'
import type { PhaseName, PhaseResult, SessionEvent, Subject } from './types'

const PHASE_GUARD = 24

function persist(root: string, ctx: AgentTurnContext): void {
  writeFileSync(join(root, 'informal.aspec'), ctx.informalMarkdown ?? '')
  writeFileSync(join(root, 'hybrid.asfl'), ctx.hybridAsfl ?? '')
  writeFileSync(join(root, 'gui.html'), ctx.guiHtml ?? '')
}

export async function runPhase(o: {
  subject: Subject
  phase: PhaseName
  projectRoot: string
  ctx: AgentTurnContext
  maxApprovals: number
  onEvent: (e: SessionEvent) => void
}): Promise<PhaseResult> {
  const skillId =
    o.phase === 'informal' ? 'requirement-discovery' : o.phase === 'hybrid' ? 'hybrid-generation' : 'hybrid-refinement'
  const permissions: AgentSpecPermissions =
    o.phase === 'hybrid' ? generationAgentPermissions() : defaultAgentPermissions()
  o.ctx.skillId = skillId
  o.ctx.permissions = permissions
  o.ctx.promptExtras = promptExtras(o.subject)
  const userText = phaseUserText(o.subject, o.phase)
  const resolve = resolveFromFacts(o.subject.authorizedFacts)
  const tools: string[] = []
  const now = new Date().toISOString()
  let session: AgentSession = {
    id: newId('sess'),
    moduleId: 'project',
    title: `${o.subject.id} ${o.phase}`,
    createdAt: now,
    updatedAt: now,
    messages: [],
    context: { skillId, permissions }
  }
  o.onEvent({ at: localIso(), phase: o.phase, type: 'phase_start', skillId })
  session = await runAgentTurn(session, o.projectRoot, o.ctx, userText)

  let approvals = 0
  let clarificationsAnswered = 0
  let clarificationsMatched = 0
  let clarificationsUnmatched = 0
  let stopReason = 'agent finished'

  for (let guard = 0; guard < PHASE_GUARD; guard++) {
    const pending = session.messages.find((m) => m.pending)
    const toolId = session.context.pendingToolCallId
    if (!pending || !toolId) break
    const last = approvals + 1 >= o.maxApprovals
    if (pending.clarification) {
      const ask: ClarificationAsk = {
        question: String(pending.clarification.question || 'Please clarify.'),
        options: pending.clarification.options,
        multiSelect: pending.clarification.multiSelect,
        allowCustom: pending.clarification.allowCustom
      }
      o.onEvent({
        at: localIso(),
        phase: o.phase,
        type: 'clarification_asked',
        question: ask.question,
        options: (ask.options ?? []).map((x) => x.label)
      })
      const resolved: ClarificationResolution = resolve(ask)
      const reply = String(resolved?.text ?? '').trim()
      const unmatched = !!resolved?.unmatched || !reply
      if (unmatched) clarificationsUnmatched++
      else clarificationsMatched++
      o.onEvent({
        at: localIso(),
        phase: o.phase,
        type: 'oracle_reply',
        question: ask.question,
        matched: !unmatched,
        unmatched,
        matchedSlotIds: resolved.matchedSlotIds ?? [],
        answerPreview: reply.slice(0, 240)
      })
      clarificationsAnswered++
      session = await resumeWithToolResult(session, o.projectRoot, o.ctx, toolId, reply, undefined, !last)
      if (last) {
        stopReason = 'call budget reached'
        break
      }
      continue
    }
    const patch = pending.proposedChanges!
    const tool = pending.toolCalls?.find((t) => t.id === toolId)?.name ?? patch.target ?? 'unknown'
    tools.push(tool)
    let applied = false
    let applyError: string | undefined
    let payload: Record<string, unknown>
    if (patch.target === 'informal') {
      const r = applyInformalProposal(o.ctx.informalMarkdown ?? '', patch)
      o.ctx.informalMarkdown = r.content
      applied = r.applied
      applyError = r.error
      payload = r.error ? { action: r.applied ? 'applied' : 'error', error: r.error } : { action: 'applied' }
    } else if (patch.target === 'hybrid') {
      const r = applyHybrid(o.ctx.hybridAsfl ?? '', patch, o.projectRoot)
      o.ctx.hybridAsfl = r.content
      applied = r.applied
      applyError = r.error
      payload = r.error ? { action: r.applied ? 'applied' : 'error', error: r.error } : { action: 'applied' }
    } else if (patch.target === 'gui') {
      const r = applyGuiProposal(o.ctx.guiHtml ?? '', patch)
      o.ctx.guiHtml = r.content
      applied = r.applied
      applyError = r.error
      payload = r.error ? { action: r.applied ? 'applied' : 'error', error: r.error } : { action: 'applied' }
    } else {
      payload = { action: 'error', error: `unsupported patch target ${String(patch.target)}` }
      applyError = String(payload.error)
    }
    persist(o.projectRoot, o.ctx)
    approvals++
    o.onEvent({
      at: localIso(),
      phase: o.phase,
      type: 'proposal',
      tool,
      applied,
      applyError,
      explanation: patch.explanation ?? '',
      target: patch.target,
      opKinds: (patch.operations ?? []).map((op) => String(op.op ?? op.kind ?? '')).filter(Boolean)
    })
    session = await resumeWithToolResult(
      session,
      o.projectRoot,
      o.ctx,
      toolId,
      JSON.stringify(payload),
      undefined,
      approvals < o.maxApprovals
    )
    if (approvals >= o.maxApprovals) {
      stopReason = 'approval budget reached'
      break
    }
  }
  persist(o.projectRoot, o.ctx)
  if (stopReason === 'agent finished' && clarificationsAnswered > 0 && approvals === 0) {
    stopReason = 'clarify_without_write'
  }
  o.onEvent({ at: localIso(), phase: o.phase, type: 'phase_end', stopReason, approvals })
  return {
    phase: o.phase,
    skillId,
    approvals,
    clarificationsAnswered,
    clarificationsMatched,
    clarificationsUnmatched,
    stopReason,
    tools
  }
}

export function phasesFor(subject: Subject): PhaseName[] {
  if (subject.task === 'extension') return ['extension']
  return ['informal', 'hybrid', 'extension']
}

export function ensureProjectDir(root: string): void {
  mkdirSync(join(root, '.agile-sofl'), { recursive: true })
}

export function writeExperiment(root: string, participantId: string): void {
  mkdirSync(join(root, '.agile-sofl'), { recursive: true })
  writeFileSync(
    join(root, '.agile-sofl', 'experiment.json'),
    JSON.stringify({ condition: 'T', participantId, telemetry: true, logPrompts: false, subjectType: 'agent-simulated' }, null, 2)
  )
}
