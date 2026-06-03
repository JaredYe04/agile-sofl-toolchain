import { onMounted, onUnmounted } from 'vue'
import { useDocumentStore } from '../stores/document'
import { useFileActions } from './useFileActions'

export function useKeyboardShortcuts(onEdit: (cmd: string) => void): void {
  const doc = useDocumentStore()
  const files = useFileActions()

  function handler(e: KeyboardEvent): void {
    const mod = e.ctrlKey || e.metaKey
    if (!mod) return

    const key = e.key.toLowerCase()
    if (key === 'n') {
      e.preventDefault()
      doc.newTab()
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
    } else if (key === 'z' && !e.shiftKey) {
      e.preventDefault()
      onEdit('undo')
    } else if ((key === 'z' && e.shiftKey) || key === 'y') {
      e.preventDefault()
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

  onMounted(() => window.addEventListener('keydown', handler))
  onUnmounted(() => window.removeEventListener('keydown', handler))
}
