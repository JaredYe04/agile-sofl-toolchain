import { applyInformalSourcePatch } from '@agile-sofl/aspec'
import { patchGui, type PatchGuiAction } from '@agile-sofl/gui'
import { applyHybridProposal } from '../agent-harness/core'
import { applySourceEdits, isSourcePatch } from '../../src/shared/sourceEdit'
import type { InformalPatchPayload } from '../../src/main/services/llm/agentTypes'

export type ApplyResult = { content: string; applied: boolean; error?: string }

export function applyInformalProposal(source: string, patch: InformalPatchPayload): ApplyResult {
  if (isSourcePatch(patch)) {
    const r = applySourceEdits(source, patch.operations)
    return { content: r.content, applied: r.applied, error: r.error }
  }
  const r = applyInformalSourcePatch(source, {
    operations: patch.operations as never,
    explanation: patch.explanation
  })
  return { content: r.content, applied: r.content !== source, error: r.ok ? undefined : r.error }
}

export function applyHybrid(source: string, patch: InformalPatchPayload, projectRoot: string): ApplyResult {
  return applyHybridProposal(source, patch, projectRoot)
}

function toGuiAction(op: Record<string, unknown>): PatchGuiAction | null {
  const kind = String(op.op || op.action || '')
  if (kind === 'replace-html' || kind === 'replace-document') {
    return { action: 'replace-html', html: String(op.html ?? op.text ?? '') }
  }
  if (kind === 'add' || kind === 'add-screen') {
    return {
      action: 'add-screen',
      screen: {
        id: String(op.id || op.name || `scr-${Date.now()}`),
        name: String(op.name || op.id || 'Screen'),
        title: typeof op.title === 'string' ? op.title : undefined,
        widgets: [],
        html: typeof op.html === 'string' ? op.html : typeof op.text === 'string' ? op.text : undefined
      }
    }
  }
  if (kind === 'remove' || kind === 'remove-screen') {
    return { action: 'remove-screen', screenId: String(op.id || op.screenId || '') }
  }
  if (kind === 'replace-screen-html') {
    return {
      action: 'replace-screen-html',
      screenId: String(op.screenId || op.id || ''),
      html: String(op.html || op.text || '')
    }
  }
  if (kind === 'insert-html') {
    return { action: 'insert-html', parentPath: String(op.parentPath || op.screenId || '0'), html: String(op.html || op.text || '') }
  }
  if (kind === 'patch-node') {
    return {
      action: 'patch-node',
      path: String(op.path || op.id || ''),
      attrs: (op.attrs as Record<string, string | null> | undefined) ?? undefined,
      text: typeof op.text === 'string' ? op.text : undefined
    }
  }
  if (kind === 'remove-node') {
    return { action: 'remove-node', path: String(op.path || op.id || '') }
  }
  return null
}

export function applyGuiProposal(source: string, patch: InformalPatchPayload): ApplyResult {
  if (isSourcePatch(patch)) {
    const r = applySourceEdits(source, patch.operations)
    return { content: r.content, applied: r.applied, error: r.error }
  }
  try {
    let next = source
    for (const op of patch.operations) {
      const action = toGuiAction(op)
      if (!action) continue
      next = patchGui(next, action)
    }
    return { content: next, applied: next !== source }
  } catch (e) {
    return { content: source, applied: false, error: e instanceof Error ? e.message : String(e) }
  }
}
