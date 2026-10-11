import { HistoryKinds } from '../history/kinds'
import { useHistoryStore } from '../stores/history'
import { useWorkspaceStore } from '../stores/workspace'
import { fileBelongsToRoot } from '../stores/tabUtils'
import { applySourceEdits, isSourcePatch } from '../../shared/sourceEdit'
import { impactForStoredPatch, writePathForPatch } from '../../shared/dasr/extract'
import { screenRuntimeWrite } from '../../shared/dasr/runtime'
import type { InformalPatchPayload, PatchGuiActionOnly } from '../../preload/index'

function toPatchAction(op: Record<string, unknown>): PatchGuiActionOnly | null {
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
  if (kind === 'add-widget') {
    return {
      action: 'add-widget',
      screenId: String(op.screenId || op.parentId || ''),
      widget: {
        id: String(op.id || `w-${Date.now()}`),
        kind: (op.kind as 'button') || 'button',
        label: typeof op.label === 'string' ? op.label : String(op.name || 'Widget'),
        process: typeof op.process === 'string' ? op.process : undefined,
        nav: typeof op.nav === 'string' ? op.nav : undefined
      }
    }
  }
  if (kind === 'replace-screen-html') {
    return {
      action: 'replace-screen-html',
      screenId: String(op.screenId || op.id || ''),
      html: String(op.html || op.text || '')
    }
  }
  if (kind === 'insert-html') {
    return {
      action: 'insert-html',
      parentPath: String(op.parentPath || op.screenId || '0'),
      html: String(op.html || op.text || '')
    }
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

export async function applyGuiDocumentPatch(
  patch: InformalPatchPayload,
  errors: { noTab: string; applyFailed: string }
): Promise<{ ok: boolean; error?: string; applied?: boolean; repairNotes?: string[] }> {
  const workspace = useWorkspaceStore()
  const guiTab = workspace.guiTab
  const root = workspace.activeProject?.rootPath
  if (!guiTab) return { ok: false, error: errors.noTab }
  if (root && guiTab.filePath && !fileBelongsToRoot(guiTab.filePath, root)) {
    return { ok: false, error: errors.noTab }
  }
  if (isSourcePatch(patch)) {
    // dasr-gate:propose_source_edit
    const result = applySourceEdits(guiTab.content, patch.operations)
    if (!result.applied && result.error) return { ok: false, error: result.error || errors.applyFailed }
    const decision = impactForStoredPatch(patch)
    const screened = screenRuntimeWrite({
      writePath: 'propose_source_edit',
      impact: decision.impact,
      commitment: decision.commitment
    })
    if (!screened.allow) return { ok: false, error: screened.error, applied: false }
    if (result.content === guiTab.content) return { ok: !result.error, error: result.error, applied: false }
    useHistoryStore().applyDocument(guiTab.id, result.content, {
      kind: HistoryKinds.guiEdit,
      immediate: true,
      decisionAlreadyScreened: true
    })
    return { ok: true, applied: true, repairNotes: result.error ? [result.error] : undefined }
  }
  if (!window.studio?.patchGui) return { ok: false, error: errors.applyFailed }
  try {
    let next = guiTab.content
    for (const op of patch.operations) {
      const action = toPatchAction(op)
      if (!action) continue
      next = await window.studio.patchGui({ source: next, ...action })
    }
    const applied = next !== guiTab.content
    if (applied) {
      // dasr-gate:propose_gui_changes
      const decision = impactForStoredPatch(patch)
      const screened = screenRuntimeWrite({
        writePath: writePathForPatch('propose_gui_changes', patch),
        impact: decision.impact,
        commitment: decision.commitment
      })
      if (!screened.allow) return { ok: false, error: screened.error, applied: false }
      useHistoryStore().applyDocument(guiTab.id, next, {
        kind: HistoryKinds.guiEdit,
        immediate: true,
        decisionAlreadyScreened: true
      })
    }
    return { ok: true, applied }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
