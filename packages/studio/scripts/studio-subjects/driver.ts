/**
 * Studio subject driver.
 *
 * Uses the production agent loop (`runAgentTurn` / `resumeWithToolResult` — the
 * same functions `studio:agent-chat` and `studio:agent-resume` call) and applies
 * or rejects proposals through `applyStudioProposal`, which composes the same
 * main-process services as AgentPanel (patch + acceptHybridWrite + patchGui).
 *
 * A pending proposal is never approved in the same tick. The subject model
 * samples a thinking time, the runner waits, then Accept or Reject.
 * Reject sends `{ action: 'rejected' }`, matching AgentPanel.rejectPatch.
 *
 * This file does not set AGILE_SOFL_HARNESS_SKIP_POST_WRITE_DIAG, so an accepted
 * hybrid write still logs post_write_diagnostics.
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyStudioProposal } from '../../src/main/services/agentProposal'
import { runAgentTurn, resumeWithToolResult, type AgentTurnContext } from '../../src/main/services/llm/agentLoop'
import {
  defaultAgentPermissions,
  generationAgentPermissions,
  newId,
  type AgentSession,
  type AgentSpecPermissions,
  type InformalPatchPayload
} from '../../src/main/services/llm/agentTypes'
import { phaseUserText, promptExtras, taskBriefMarkdown } from './briefs'
import type { AgentModel } from './types'
import { resolveFromFacts, type ClarificationAsk } from './oracle'
import { decideProposal, patchChars } from './policy'
import { assignTexts, initSubjectProject, persistProject, textsOf } from './project'
import { localIso, rngFor, thinkingMsAt, wallSleepMs } from './timing'
import type { Pace, PhaseName, Subject } from './types'

const PHASE_GUARD = 24

export type SleepFn = (ms: number) => Promise<void>

export type SubjectRunResult = {
  id: string
  outDir: string
  projectRoot: string
  pace: Pace
  decisions: number
  accepts: number
  rejects: number
  errors: number
  clarifications: number
  minIntendedThinkingMs: number | null
  minSleptMs: number | null
  stopReasons: string[]
}

type SessionEvent = {
  at: string
  phase?: PhaseName
  type: string
  [k: string]: unknown
}

function phasesFor(subject: Subject): PhaseName[] {
  if (subject.task === 'extension') return ['extension']
  return ['informal', 'hybrid', 'extension']
}

const defaultSleep: SleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function pause(intendedMs: number, pace: Pace, sleep: SleepFn): Promise<number> {
  const sleptMs = wallSleepMs(intendedMs, pace)
  await sleep(sleptMs)
  return sleptMs
}

function writeExperiment(root: string, subject: Subject): void {
  mkdirSync(join(root, '.agile-sofl'), { recursive: true })
  writeFileSync(
    join(root, '.agile-sofl', 'experiment.json'),
    JSON.stringify(
      {
        condition: 'T',
        participantId: subject.id,
        telemetry: true,
        logPrompts: false,
        subjectType: 'agent-simulated',
        runtime: 'studio-main-process'
      },
      null,
      2
    )
  )
}

export async function runSubject(o: {
  subject: Subject
  model: AgentModel
  assetsDir: string
  outDir: string
  pace: Pace
  maxDecisions: number
  sleep?: SleepFn
}): Promise<SubjectRunResult> {
  if (o.model.id !== o.subject.id) throw new Error(`model ${o.model.id} does not match subject ${o.subject.id}`)
  const sleep = o.sleep ?? defaultSleep
  const skippedDiag = process.env.AGILE_SOFL_HARNESS_SKIP_POST_WRITE_DIAG
  delete process.env.AGILE_SOFL_HARNESS_SKIP_POST_WRITE_DIAG
  const projectRoot = join(o.outDir, 'project')
  const eventsFile = join(o.outDir, 'events.jsonl')
  mkdirSync(o.outDir, { recursive: true })
  writeFileSync(join(o.outDir, 'task-brief.md'), `${taskBriefMarkdown(o.subject)}\n`)
  writeFileSync(join(o.outDir, 'agent-model.json'), `${JSON.stringify(o.model, null, 2)}\n`)
  const events: SessionEvent[] = []
  const log = (event: SessionEvent) => {
    events.push(event)
    appendFileSync(eventsFile, `${JSON.stringify(event)}\n`)
  }
  try {
    const ctx = initSubjectProject({ projectRoot, subject: o.subject, assetsDir: o.assetsDir })
    writeExperiment(projectRoot, o.subject)
    const resolve = resolveFromFacts(o.subject.authorizedFacts)
    let stream = 0
    let decisions = 0
    let accepts = 0
    let rejects = 0
    let errors = 0
    let clarifications = 0
    let minIntended: number | null = null
    let minSlept: number | null = null
    const stopReasons: string[] = []
    const noteWait = (intendedMs: number, sleptMs: number) => {
      minIntended = minIntended == null ? intendedMs : Math.min(minIntended, intendedMs)
      minSlept = minSlept == null ? sleptMs : Math.min(minSlept, sleptMs)
    }

    for (const phase of phasesFor(o.subject)) {
      const phaseResult = await runPhase({
        subject: o.subject,
        model: o.model,
        phase,
        ctx,
        projectRoot,
        maxDecisions: o.maxDecisions,
        pace: o.pace,
        sleep,
        resolve,
        nextStream: () => ++stream,
        log,
        noteWait
      })
      decisions += phaseResult.decisions
      accepts += phaseResult.accepts
      rejects += phaseResult.rejects
      errors += phaseResult.errors
      clarifications += phaseResult.clarifications
      stopReasons.push(`${phase}:${phaseResult.stopReason}`)
    }

    const summary: SubjectRunResult = {
      id: o.subject.id,
      outDir: o.outDir,
      projectRoot,
      pace: o.pace,
      decisions,
      accepts,
      rejects,
      errors,
      clarifications,
      minIntendedThinkingMs: minIntended,
      minSleptMs: minSlept,
      stopReasons
    }
    writeFileSync(
      join(o.outDir, 'manifest.json'),
      JSON.stringify(
        {
          runtime: 'studio-main-process',
          decisionPath: 'applyStudioProposal + resumeWithToolResult',
          electronGui: false,
          instantApprove: false,
          ...summary,
          modelId: o.model.id,
          interpreter: o.model.interpreter
        },
        null,
        2
      )
    )
    return summary
  } finally {
    if (skippedDiag === undefined) delete process.env.AGILE_SOFL_HARNESS_SKIP_POST_WRITE_DIAG
    else process.env.AGILE_SOFL_HARNESS_SKIP_POST_WRITE_DIAG = skippedDiag
  }
}

async function runPhase(o: {
  subject: Subject
  model: AgentModel
  phase: PhaseName
  ctx: AgentTurnContext
  projectRoot: string
  maxDecisions: number
  pace: Pace
  sleep: SleepFn
  resolve: ReturnType<typeof resolveFromFacts>
  nextStream: () => number
  log: (event: SessionEvent) => void
  noteWait: (intendedMs: number, sleptMs: number) => void
}): Promise<{
  decisions: number
  accepts: number
  rejects: number
  errors: number
  clarifications: number
  stopReason: string
}> {
  const skillId =
    o.phase === 'informal' ? 'requirement-discovery' : o.phase === 'hybrid' ? 'hybrid-generation' : 'hybrid-refinement'
  const permissions: AgentSpecPermissions =
    o.phase === 'hybrid' ? generationAgentPermissions() : defaultAgentPermissions()
  o.ctx.skillId = skillId
  o.ctx.permissions = permissions
  o.ctx.promptExtras = promptExtras(o.subject)
  const userText = phaseUserText(o.subject, o.phase)
  const now = new Date().toISOString()
  let session: AgentSession = {
    id: newId('sess'),
    moduleId: o.subject.systemName,
    title: `${o.subject.id} ${o.phase}`,
    createdAt: now,
    updatedAt: now,
    messages: [],
    context: { skillId, permissions }
  }
  o.log({ at: localIso(), phase: o.phase, type: 'phase_start', skillId })
  session = await runAgentTurn(session, o.projectRoot, o.ctx, userText)

  let decisions = 0
  let accepts = 0
  let rejects = 0
  let errors = 0
  let clarifications = 0
  let stopReason = 'agent finished'

  for (let guard = 0; guard < PHASE_GUARD; guard++) {
    const pending = session.messages.find((m) => m.pending)
    const toolId = session.context.pendingToolCallId
    if (!pending || !toolId) break
    if (pending.clarification) {
      const ask: ClarificationAsk = {
        question: String(pending.clarification.question || 'Please clarify.'),
        options: pending.clarification.options,
        multiSelect: pending.clarification.multiSelect,
        allowCustom: pending.clarification.allowCustom
      }
      const rng = rngFor(o.model.seed, o.nextStream())
      const intendedMs = thinkingMsAt(o.model.clarificationThink, ask.question.length, rng())
      const sleptMs = await pause(intendedMs, o.pace, o.sleep)
      o.noteWait(intendedMs, sleptMs)
      const resolved = o.resolve(ask)
      const reply = String(resolved.text ?? '').trim() || resolved.text
      const unmatched = !!resolved.unmatched || !reply
      clarifications++
      o.log({
        at: localIso(),
        phase: o.phase,
        type: 'clarification_answer',
        question: ask.question,
        matched: !unmatched,
        unmatched,
        matchedSlotIds: resolved.matchedSlotIds ?? [],
        answerPreview: reply.slice(0, 240),
        intendedThinkingMs: intendedMs,
        sleptMs
      })
      session = await resumeWithToolResult(session, o.projectRoot, o.ctx, toolId, reply, undefined, true)
      continue
    }
    const patch = pending.proposedChanges
    if (!patch) break
    const tool =
      pending.toolCalls?.find((call) => call.id === toolId)?.name ??
      (patch.target ? `propose_${patch.target}_changes` : 'propose_changes')
    const atBudget = decisions + 1 >= o.maxDecisions
    const decision = decideProposal(o.model, patch, rngFor(o.model.seed, o.nextStream()))
    const sleptMs = await pause(decision.thinkingMs, o.pace, o.sleep)
    o.noteWait(decision.thinkingMs, sleptMs)
    let resumeBody: Record<string, unknown>
    let applied = false
    if (decision.decision === 'reject') {
      resumeBody = { action: 'rejected' }
      rejects++
    } else {
      const outcome = applyStudioProposal(textsOf(o.ctx), patch as InformalPatchPayload, o.projectRoot)
      const stored = persistProject(o.projectRoot, outcome.texts, o.subject)
      assignTexts(o.ctx, stored)
      resumeBody = outcome.body
      applied = outcome.applied
      if (outcome.body.action === 'error') errors++
      else accepts++
    }
    decisions++
    o.log({
      at: localIso(),
      phase: o.phase,
      type: 'proposal_decision',
      tool,
      target: patch.target,
      policy: decision.decision,
      resumeAction: resumeBody.action,
      applied,
      acceptProbability: decision.acceptProbability,
      risk: decision.risk,
      reasons: decision.reasons,
      draw: decision.draw,
      intendedThinkingMs: decision.thinkingMs,
      sleptMs,
      patchChars: patchChars(patch),
      explanation: patch.explanation ?? ''
    })
    session = await resumeWithToolResult(
      session,
      o.projectRoot,
      o.ctx,
      toolId,
      JSON.stringify(resumeBody),
      undefined,
      !atBudget
    )
    if (decisions >= o.maxDecisions) {
      stopReason = 'decision budget reached'
      break
    }
  }
  if (stopReason === 'agent finished' && clarifications > 0 && decisions === 0) stopReason = 'clarify_without_write'
  o.log({ at: localIso(), phase: o.phase, type: 'phase_end', stopReason, decisions, accepts, rejects })
  return { decisions, accepts, rejects, errors, clarifications, stopReason }
}
