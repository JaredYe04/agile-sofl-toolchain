import { onMounted, onUnmounted } from 'vue'
import { useFileActions } from './useFileActions'
import { useDocumentStore } from '../stores/document'
import { useDocumentHistoryStore } from '../stores/documentHistory'
import { isMonacoFocused, isEditableFieldFocused, shouldUseNativeClipboard } from './editCommands'

export function useKeyboardShortcuts(
  onEdit: (cmd: string) => void,
  onDevTools?: () => void,
  onNewFile?: () => void,
  onFormat?: () => void,
  onUndoRedo?: (cmd: 'undo' | 'redo') => boolean
): void {
  const files = useFileActions()
  const doc = useDocumentStore()
  const history = useDocumentHistoryStore()

  function handler(e: KeyboardEvent): void {
    const mod = e.ctrlKey || e.metaKey
    const key = e.key.toLowerCase()

    if (e.shiftKey && e.altKey && key === 'f') {
      e.preventDefault()
      onFormat?.()
      return
    }

    if (!mod) return

    const clipboardKeys = ['c', 'v', 'x', 'a']
    if (clipboardKeys.includes(key) && shouldUseNativeClipboard()) {
      return
    }

    if (key === 'n') {
      e.preventDefault()
      onNewFile?.()
    } else if (key === 'o') {
      e.preventDefault()
      files.openFile()
    } else if (key === 's' && e.shiftKey) {
      e.preventDefault()
      files.saveAsTab()
    } else if (key === 's') {
      e.preventDefault()
      files.saveTab()
    } else if (key === 'w') {
      e.preventDefault()
      files.closeActiveTab()
    } else if (key === 'i' && e.shiftKey) {
      e.preventDefault()
      onDevTools?.()
    } else if (key === 'z' && !e.shiftKey) {
      e.preventDefault()
      if (onUndoRedo?.('undo')) return
      onEdit('undo')
    } else if ((key === 'z' && e.shiftKey) || key === 'y') {
      e.preventDefault()
      if (onUndoRedo?.('redo')) return
      onEdit('redo')
    } else if (key === 'a') {
      e.preventDefault()
      onEdit('selectAll')
    } else if (key === 'x') {
      e.preventDefault()
      onEdit('cut')
    } else if (key === 'c') {
      e.preventDefault()
      onEdit('copy')
    } else if (key === 'v') {
      e.preventDefault()
      onEdit('paste')
    }
  }

  onMounted(() => window.addEventListener('keydown', handler, true))
  onUnmounted(() => window.removeEventListener('keydown', handler, true))
}
