import { HistoryKinds } from '../history/kinds'
import { useHistoryStore } from '../stores/history'
import { useWorkspaceStore } from '../stores/workspace'
import { fileBelongsToRoot } from '../stores/tabUtils'
import { applySourceEdits, isSourcePatch } from '../../shared/sourceEdit'
import { toGuiPatchAction as toPatchAction } from '../../shared/guiPatchAction'
import type { InformalPatchPayload, PatchGuiPayload } from '../../preload/index'

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
    const result = applySourceEdits(guiTab.content, patch.operations)
    if (!result.applied) return { ok: false, error: result.error || errors.applyFailed }
    useHistoryStore().applyDocument(guiTab.id, result.content, {
      kind: HistoryKinds.guiEdit,
      immediate: true
    })
    return { ok: true, applied: true, repairNotes: result.error ? [result.error] : undefined }
  }
  if (!window.studio?.patchGui) return { ok: false, error: errors.applyFailed }
  try {
    let next = guiTab.content
    for (const op of patch.operations) {
      const action = toPatchAction(op)
      if (!action) continue
      next = await window.studio.patchGui({ source: next, ...(action as PatchGuiPayload) })
    }
    const applied = next !== guiTab.content
    if (applied) {
      useHistoryStore().applyDocument(guiTab.id, next, {
        kind: HistoryKinds.guiEdit,
        immediate: true
      })
    }
    return { ok: true, applied }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
