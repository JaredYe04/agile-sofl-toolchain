/**
 * Headless driver for the studio agent loop (runAgentTurn / resumeWithToolResult) with the real LLM.
 * Mirrors what AgentPanel.vue does in auto-write mode: every proposal is auto-approved and applied
 * exactly as applyHybridDocumentPatch would (source edit / refinement step / CRUD patch), then the loop
 * is resumed with {action:'applied'} so post_write_diagnostics are logged by the production code.
 *
 * Seed of the automated-pilot batch runner: one call = one run in one condition, written to a run
 * directory named by a random id; the condition<->id key is returned to the caller (kept out of the
 * run directory, for blind coding). Runs are strictly serial (no concurrency).
 */
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyHybridPatch } from '@agile-sofl/editor-api'
import { runAgentTurn, resumeWithToolResult, type AgentTurnContext } from '../../src/main/services/llm/agentLoop'
import { generationAgentPermissions, newId, type AgentSession, type InformalPatchPayload } from '../../src/main/services/llm/agentTypes'
import { skillById } from '../../src/main/services/llm/skills'
import { applySourceEdits, isSourcePatch } from '../../src/shared/sourceEdit'
import { applyProjectRefinementStep } from '../../src/main/services/refinementLog'

export const PILOT_TEMPERATURE = 0.35 // fixed inside agentLoop.ts; recorded here for the manifest

export interface RunOptions {
  condition: 'T' | 'B2'
  informalPath: string
  outDir: string
  skillId?: string
  userText?: string
  /** max auto-approved proposals before the turn is stopped (bounds LLM calls) */
  maxApprovals?: number
  clarificationAnswer?: string
  participantId?: string
}

export interface RunResult {
  runId: string
  runDir: string
  condition: string
  promptHash: string
  approvals: number
  stopReason: string
  hybridChars: number
}

export const DEFAULT_USER_TEXT =
  'Generate the Hybrid Specification from the Informal Specification. Strategy: rebuild (no existing Hybrid). Work incrementally with the tools.'
export const DEFAULT_CLARIFICATION = 'Rebuild from scratch. Use your best judgement and continue without further questions.'

/** Hash of everything that must be identical across conditions (input, skill prompt, user text, answers, temperature). */
export function promptHash(o: { informal: string; skillPrompt: string; userText: string; clarification: string }): string {
  return createHash('sha256')
    .update(JSON.stringify({ ...o, temperature: PILOT_TEMPERATURE }))
    .digest('hex')
}

export function applyHybridProposal(source: string, patch: InformalPatchPayload, projectRoot: string): { content: string; error?: string; applied: boolean } {
  if (isSourcePatch(patch)) {
    const r = applySourceEdits(source, patch.operations as never)
    return { content: r.content, error: r.error, applied: r.content !== source }
  }
  const stepOp = patch.operations.find((op) => op.op === 'refine-step')
  if (stepOp && patch.operations.length === 1) {
    const r = applyProjectRefinementStep(projectRoot, source, stepOp as never) as { source: string; error?: string }
    if (r.error) return { content: source, error: r.error, applied: false }
    return { content: r.source, applied: r.source !== source }
  }
  const r = applyHybridPatch(source, patch as never)
  return { content: r.content, error: r.error, applied: r.content !== source }
}

export async function runOnce(o: RunOptions): Promise<RunResult> {
  const runId = randomBytes(4).toString('hex')
  const runDir = join(o.outDir, 'runs', runId)
  mkdirSync(join(runDir, '.agile-sofl'), { recursive: true })
  writeFileSync(join(runDir, '.agile-sofl', 'experiment.json'),
    JSON.stringify({ condition: o.condition, participantId: o.participantId ?? `auto-${runId}`, telemetry: true, logPrompts: false }, null, 2))
  const informal = readFileSync(o.informalPath, 'utf-8')
  const skillId = o.skillId ?? 'hybrid-generation'
  const userText = o.userText ?? DEFAULT_USER_TEXT
  const clarification = o.clarificationAnswer ?? DEFAULT_CLARIFICATION
  const hash = promptHash({ informal, skillPrompt: skillById(skillId).prompt, userText, clarification })
  const maxApprovals = o.maxApprovals ?? 3

  const ctx: AgentTurnContext = {
    projectName: 'pilot', projectRoot: runDir, moduleId: 'project',
    informalMarkdown: informal, hybridAsfl: '', skillId, permissions: generationAgentPermissions()
  }
  const now = new Date().toISOString()
  let session: AgentSession = { id: newId('sess'), moduleId: 'project', title: 'Requirement Analysis', createdAt: now, updatedAt: now, messages: [], context: {} }
  session = await runAgentTurn(session, runDir, ctx, userText)

  let approvals = 0
  let stopReason = 'agent finished'
  for (let guard = 0; guard < 20; guard++) {
    const pending = session.messages.find((m) => m.pending)
    const toolId = session.context.pendingToolCallId
    if (!pending || !toolId) break
    const last = approvals + 1 >= maxApprovals
    if (pending.clarification) {
      session = await resumeWithToolResult(session, runDir, ctx, toolId, clarification, undefined, !last)
      if (last) { stopReason = 'call budget reached'; break }
      continue
    }
    const patch = pending.proposedChanges!
    let payload: Record<string, unknown>
    if (patch.target === 'hybrid') {
      const r = applyHybridProposal(ctx.hybridAsfl ?? '', patch, runDir)
      ctx.hybridAsfl = r.content
      writeFileSync(join(runDir, 'hybrid.asfl'), r.content)
      payload = r.error ? { action: r.applied ? 'applied' : 'error', error: r.error } : { action: 'applied' }
    } else {
      payload = { action: 'error', error: `harness only applies hybrid proposals (got ${patch.target})` }
    }
    approvals++
    session = await resumeWithToolResult(session, runDir, ctx, toolId, JSON.stringify(payload), undefined, approvals < maxApprovals)
    if (approvals >= maxApprovals) { stopReason = 'approval budget reached'; break }
  }
  writeFileSync(join(runDir, 'hybrid.asfl'), ctx.hybridAsfl ?? '')
  writeFileSync(join(runDir, 'manifest.json'), JSON.stringify({ runId, promptHash: hash, skillId, approvals, stopReason, temperature: PILOT_TEMPERATURE }, null, 2))
  return { runId, runDir, condition: o.condition, promptHash: hash, approvals, stopReason, hybridChars: (ctx.hybridAsfl ?? '').length }
}

/** Serial 429-aware fetch: retries HTTP 429/503 with exponential backoff; every retry is appended to retries.log. */
export function install429Retry(logFile: string, maxRetries = 5): void {
  const orig = globalThis.fetch
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    for (let attempt = 0; ; attempt++) {
      const res = await orig(input, init)
      if ((res.status !== 429 && res.status !== 503) || attempt >= maxRetries) return res
      const wait = Math.min(60_000, 2000 * 2 ** attempt) + Math.floor(Math.random() * 500)
      try { writeFileSync(logFile, `${new Date().toISOString()} status=${res.status} attempt=${attempt + 1} wait=${wait}ms\n`, { flag: 'a' }) } catch { /* ignore */ }
      await new Promise((r) => setTimeout(r, wait))
    }
  }) as typeof fetch
}

export function appendKey(outDir: string, r: RunResult & { system: string }): void {
  const f = join(outDir, 'blinding-key.json')
  const all = existsSync(f) ? JSON.parse(readFileSync(f, 'utf-8')) : []
  all.push({ runId: r.runId, condition: r.condition, system: r.system, promptHash: r.promptHash })
  writeFileSync(f, JSON.stringify(all, null, 2))
}
