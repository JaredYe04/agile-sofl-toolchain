export const EDIT_COMMAND_IDS: Record<string, string> = {
  undo: 'undo',
  redo: 'redo',
  cut: 'editor.action.clipboardCutAction',
  copy: 'editor.action.clipboardCopyAction',
  paste: 'editor.action.clipboardPasteAction',
  selectAll: 'editor.action.selectAll'
}

export function isMonacoFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  return Boolean(el.closest('.monaco-editor'))
}

export function isEditableFieldFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable
}

/** Let the browser handle clipboard when user selected text outside Monaco. */
export function shouldUseNativeClipboard(): boolean {
  if (isMonacoFocused() || isEditableFieldFocused()) return true
  const sel = window.getSelection()
  if (!sel?.toString()) return false
  const node = sel.anchorNode as { closest?: (s: string) => unknown; parentElement?: { closest?: (s: string) => unknown } } | null
  const el = node?.closest ? node : node?.parentElement?.closest ? node.parentElement : null
  return Boolean(el?.closest?.('.studio-text-selectable, .visual-panel'))
}
