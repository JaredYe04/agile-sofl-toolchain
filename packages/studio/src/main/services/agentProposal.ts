/**
 * Main-process Apply path used by the case-study subject runner.
 *
 * This is the same composition the Agent panel performs over IPC:
 * - Informal: `applySourceEdits` / `applyInformalSourcePatch` (`studio:patch-informal-spec`)
 * - Hybrid: `applyHybridPatch` or `applyProjectRefinementStep`, then `acceptHybridWrite`
 *   (`studio:patch-hybrid-spec`, `studio:refinement-step`, `studio:accept-hybrid-write`)
 * - GUI: `toGuiPatchAction` + `patchGui` (`studio:patch-gui`)
 *
 * Soft lint is a warning on `action: 'applied'`. Hard failures are empty patches,
 * an unknown target, or an exception from the GUI patcher. Reject is not decided
 * here — the caller resumes the agent with `{ action: 'rejected' }`, matching
 * AgentPanel.rejectPatch.
 */
import { applyInformalSourcePatch, buildInformalModel } from '@agile-sofl/aspec'
import { applyHybridPatch } from '@agile-sofl/editor-api'
import { patchGui } from '@agile-sofl/gui'
import { acceptHybridWrite, type WriteDiagnostics } from '../../shared/asflRepair'
import { toGuiPatchAction } from '../../shared/guiPatchAction'
import { applySourceEdits, isSourcePatch } from '../../shared/sourceEdit'
import type { InformalPatchPayload } from './llm/agentTypes'
import { applyProjectRefinementStep } from './refinementLog'

export type StudioTexts = {
  informal: string
  hybrid: string
  gui: string
}

export type StudioResumeBody = {
  action: 'applied' | 'error'
  ok: boolean
  error?: string
  repair?: string
  warnings?: string[]
  diagnostics?: WriteDiagnostics
}

export type StudioApplyOutcome = {
  texts: StudioTexts
  applied: boolean
  body: StudioResumeBody
}

function appliedBody(o: {
  error?: string
  repairNotes?: string[]
  warnings?: string[]
  diagnostics?: WriteDiagnostics
}): StudioResumeBody {
  const warnings = (o.warnings ?? []).filter(Boolean)
  return {
    action: 'applied',
    ok: true,
    error: o.error,
    repair: o.repairNotes?.filter(Boolean).join('; ') || undefined,
    warnings: warnings.length ? warnings : undefined,
    diagnostics: o.diagnostics
  }
}

function informalDiagnostics(source: string): WriteDiagnostics | undefined {
  try {
    const model = buildInformalModel(source)
    const items = (model.diagnostics ?? [])
      .filter((d) => d.severity === 'error' || d.severity === 'warning')
      .slice(0, 12)
      .map((d) => ({ severity: d.severity, code: d.code, message: d.message }))
    if (!items.length) return undefined
    return {
      errors: items.filter((d) => d.severity === 'error').length,
      warnings: items.filter((d) => d.severity === 'warning').length,
      items
    }
  } catch {
    return undefined
  }
}

function commitHybrid(
  before: string,
  next: string,
  softWarnings?: string[]
): { content: string; applied: boolean; body: StudioResumeBody } {
  if (next === before) {
    const warnings = (softWarnings ?? []).filter(Boolean)
    return {
      content: before,
      applied: false,
      body: appliedBody({ warnings, error: undefined })
    }
  }
  const gated = acceptHybridWrite(before, next)
  const warnings = [...(softWarnings ?? []), ...(gated.warnings ?? [])].filter(Boolean)
  const applied = gated.content !== before
  return {
    content: gated.content,
    applied,
    body: appliedBody({
      repairNotes: gated.repairNotes,
      warnings,
      diagnostics: gated.diagnostics
    })
  }
}

function applyInformal(source: string, patch: InformalPatchPayload): { content: string; applied: boolean; body: StudioResumeBody } {
  if (isSourcePatch(patch)) {
    const result = applySourceEdits(source, patch.operations)
    const applied = result.content !== source
    const warnings = result.error ? [result.error] : undefined
    return {
      content: applied ? result.content : source,
      applied,
      body: appliedBody({
        warnings,
        diagnostics: applied ? informalDiagnostics(result.content) : undefined
      })
    }
  }
  const result = applyInformalSourcePatch(source, {
    operations: patch.operations as never,
    explanation: patch.explanation
  })
  const applied = result.content !== source
  const warnings = [
    ...(result.warnings ?? []),
    !result.ok && result.error && !(result.warnings ?? []).includes(result.error) ? result.error : ''
  ].filter(Boolean)
  return {
    content: result.content,
    applied,
    body: appliedBody({
      warnings,
      diagnostics: applied ? informalDiagnostics(result.content) : undefined
    })
  }
}

function applyHybrid(source: string, patch: InformalPatchPayload, projectRoot: string): { content: string; applied: boolean; body: StudioResumeBody } {
  if (isSourcePatch(patch)) {
    const result = applySourceEdits(source, patch.operations)
    const soft = result.error ? [result.error] : undefined
    return commitHybrid(source, result.content, soft)
  }
  const stepOp = patch.operations.find((op) => op.op === 'refine-step')
  if (stepOp && patch.operations.length === 1) {
    const result = applyProjectRefinementStep(projectRoot, source, stepOp as never)
    if (result.error && result.source === source && !result.journalApplied) {
      return {
        content: source,
        applied: false,
        body: appliedBody({ warnings: result.warnings ?? [result.error] })
      }
    }
    const committed = commitHybrid(source, result.source, result.warnings ?? (result.error ? [result.error] : undefined))
    const journalApplied = Boolean(result.journalApplied)
    return {
      content: committed.content,
      applied: committed.applied || journalApplied,
      body: {
        ...committed.body,
        repair: committed.body.repair ?? result.repairNotes?.filter(Boolean).join('; ')
      }
    }
  }
  const result = applyHybridPatch(source, patch as never)
  const soft = [...(result.warnings ?? [])]
  if (result.error && !soft.includes(result.error)) soft.unshift(result.error)
  return commitHybrid(source, result.content, soft)
}

function applyGui(source: string, patch: InformalPatchPayload): { content: string; applied: boolean; body: StudioResumeBody } {
  if (isSourcePatch(patch)) {
    const result = applySourceEdits(source, patch.operations)
    const applied = result.content !== source
    if (!applied) {
      return {
        content: source,
        applied: false,
        body: { action: 'error', ok: false, error: result.error || 'GUI source edit was not applied.' }
      }
    }
    return {
      content: result.content,
      applied: true,
      body: appliedBody({ warnings: result.error ? [result.error] : undefined })
    }
  }
  let next = source
  for (const op of patch.operations) {
    const action = toGuiPatchAction(op)
    if (!action) continue
    next = patchGui(next, action)
  }
  return {
    content: next,
    applied: next !== source,
    body: appliedBody({})
  }
}

export function applyStudioProposal(
  texts: StudioTexts,
  patch: InformalPatchPayload,
  projectRoot: string
): StudioApplyOutcome {
  if (!patch.operations?.length) {
    return {
      texts,
      applied: false,
      body: { action: 'error', ok: false, error: 'Empty patch.' }
    }
  }
  try {
    if (patch.target === 'informal' || (!patch.target && !isHybridish(patch))) {
      const r = applyInformal(texts.informal, patch)
      return { texts: { ...texts, informal: r.content }, applied: r.applied, body: r.body }
    }
    if (patch.target === 'hybrid') {
      const r = applyHybrid(texts.hybrid, patch, projectRoot)
      return { texts: { ...texts, hybrid: r.content }, applied: r.applied, body: r.body }
    }
    if (patch.target === 'gui') {
      const r = applyGui(texts.gui, patch)
      return { texts: { ...texts, gui: r.content }, applied: r.applied, body: r.body }
    }
    return {
      texts,
      applied: false,
      body: { action: 'error', ok: false, error: `Unsupported patch target ${String(patch.target)}` }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { texts, applied: false, body: { action: 'error', ok: false, error: message } }
  }
}

function isHybridish(patch: InformalPatchPayload): boolean {
  return patch.operations.some((op) => op.op === 'refine-step' || op.kind === 'module' || op.kind === 'process')
}
