import { nextTick } from 'vue'
import { useEditorUiStore } from '../stores/editorUi'
import { useWorkspaceStore } from '../stores/workspace'
import type { SerializableSpan } from '../components/editor/MonacoEditor.vue'

export type CodeEditorHandle = {
  revealSpan: (span: SerializableSpan) => void
  relayout?: () => void
}

/** Switch to a code surface, then reveal a span without leaving the user stuck in visual-only mode. */
export async function revealInCodeEditor(
  editor: CodeEditorHandle | null | undefined,
  span: SerializableSpan | undefined,
  options?: { hybrid?: boolean; gui?: boolean }
): Promise<void> {
  if (!span) return
  const editorUi = useEditorUiStore()
  const workspace = useWorkspaceStore()
  if (editorUi.viewMode === 'visual') editorUi.setViewMode('split')
  if (options?.hybrid) workspace.hybridMode = 'code'
  if (options?.gui) workspace.guiMode = 'code'
  await nextTick()
  editor?.relayout?.()
  editor?.revealSpan(span)
}
