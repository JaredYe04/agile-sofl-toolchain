import { toAsflIdent, processStubTemplate } from './ident'
import type { VisualModelContext } from '../composables/visualModelContext'
import { useWorkspaceStore } from '../stores/workspace'
import { useModalStore } from '../stores/modal'
import { useDocumentStore } from '../stores/document'
import { useHistoryStore } from '../stores/history'
import { HistoryKinds } from '../history/kinds'
import { filePathsEqual } from '../stores/tabUtils'

export async function insertHybridProcessSkeleton(
  visual: VisualModelContext | null,
  t: (key: string, params?: Record<string, unknown>) => string
): Promise<void> {
  const workspace = useWorkspaceStore()
  const modal = useModalStore()
  const doc = useDocumentStore()
  const moduleName = workspace.selectedModuleName ?? workspace.modules[0]?.name
  if (!moduleName) {
    workspace.hybridMode = 'code'
    return
  }
  const { index, value } = await modal.show({
    title: t('hybrid.assist.skeletonTitle'),
    message: t('hybrid.assist.skeletonMessage'),
    input: true,
    inputPlaceholder: t('hybrid.assist.skeletonPlaceholder'),
    buttons: [t('dialog.ok'), t('dialog.cancel')]
  })
  if (index !== 0 || !value?.trim()) return
  const name = toAsflIdent(value)
  const template = processStubTemplate(name, value.trim())
  if (visual && !visual.parseFailed.value) {
    await visual.patchProcess({
      moduleName,
      kind: 'process',
      action: 'add',
      name,
      template
    })
    workspace.selectModule(moduleName, { kind: 'process', moduleName, processName: name })
    return
  }
  workspace.hybridMode = 'code'
  const tab = workspace.hybridTab
  if (!tab || !window.studio?.patchProcess) return
  const next = await window.studio.patchProcess({
    source: tab.content,
    moduleName,
    kind: 'process',
    action: 'add',
    name,
    template
  })
  const history = useHistoryStore()
  history.applyDocument(tab.id, next, { kind: HistoryKinds.visualPatch, immediate: true })
  if (tab.filePath) {
    const found = doc.documentTabs.find((x) => x.filePath && filePathsEqual(x.filePath, tab.filePath!))
    if (found) doc.setActive(found.id)
  }
}
