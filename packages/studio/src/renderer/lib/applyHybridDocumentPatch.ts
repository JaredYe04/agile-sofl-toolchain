import { applySourceEdits, isSourcePatch } from '../../shared/sourceEdit'
import { HistoryKinds } from '../history/kinds'
import { useHistoryStore } from '../stores/history'
import { useWorkspaceStore } from '../stores/workspace'
import { fileBelongsToRoot } from '../stores/tabUtils'
import type { InformalPatchPayload } from '../../preload/index'

export async function applyHybridDocumentPatch(
  patch: InformalPatchPayload,
  errors: { noTab: string; applyFailed: string }
): Promise<{ ok: boolean; error?: string; applied?: boolean }> {
  const workspace = useWorkspaceStore()
  const hybridTab = workspace.hybridTab
  const root = workspace.activeProject?.rootPath
  if (!hybridTab) return { ok: false, error: errors.noTab }
  if (root && hybridTab.filePath && !fileBelongsToRoot(hybridTab.filePath, root)) {
    return { ok: false, error: errors.noTab }
  }
  if (isSourcePatch(patch)) {
    const result = applySourceEdits(hybridTab.content, patch.operations)
    const applied = result.content !== hybridTab.content
    if (applied) {
      useHistoryStore().applyDocument(hybridTab.id, result.content, {
        kind: HistoryKinds.visualPatch,
        immediate: true
      })
      void workspace.resyncModulesFromOpenTabs()
    }
    if (result.error) return { ok: false, error: result.error, applied }
    return { ok: true, applied }
  }
  if (!window.studio?.patchHybridSpec) return { ok: false, error: errors.applyFailed }
  try {
    const result = await window.studio.patchHybridSpec({ source: hybridTab.content, patch })
    const applied = result.content !== hybridTab.content
    if (applied) {
      useHistoryStore().applyDocument(hybridTab.id, result.content, {
        kind: HistoryKinds.visualPatch,
        immediate: true
      })
      void workspace.resyncModulesFromOpenTabs()
    }
    if (result.error) return { ok: false, error: result.error, applied }
    return { ok: true, applied }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
