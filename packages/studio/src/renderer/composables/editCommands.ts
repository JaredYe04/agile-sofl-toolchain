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

/** Let the browser handle undo in ordinary inputs; Studio owns Monaco and Informal Vditor. */
export function shouldUseNativeUndo(): boolean {
  if (isMonacoFocused()) return false
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  if (el.closest('.informal-vditor, .informal-md-shell, .vditor')) return false
  return isEditableFieldFocused()
}

const NATIVE_CLIPBOARD_SELECTORS =
  '.studio-text-selectable, .visual-panel, .agent-bubble, .agent-markdown-preview'

function elementForSelectionNode(node: Node | null): Element | null {
  if (!node) return null
  if (node.nodeType === 1) return node as Element
  return node.parentElement
}

function selectionInNativeClipboardRegion(sel: Selection): boolean {
  for (const node of [sel.anchorNode, sel.focusNode]) {
    const el = elementForSelectionNode(node)
    if (el?.closest(NATIVE_CLIPBOARD_SELECTORS)) return true
  }
  return false
}

/** Let the browser handle clipboard when user selected text outside Monaco. */
export function shouldUseNativeClipboard(): boolean {
  if (isMonacoFocused() || isEditableFieldFocused()) return true
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false
  return selectionInNativeClipboardRegion(sel)
}
