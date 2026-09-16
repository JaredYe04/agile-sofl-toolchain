import type { SerializableSpan } from '../../preload/index'
import type { TreeSelection } from '../composables/useVisualModel'

export type HybridSpanModel = {
  modules: Array<{
    name: string
    span?: SerializableSpan
    processes: Array<{ name: string; span?: SerializableSpan }>
    functions: Array<{ name: string; span?: SerializableSpan }>
  }>
  moduleGraph?: unknown
} | null

function graphNodeSpan(graph: unknown, moduleName: string): SerializableSpan | null {
  if (!graph || typeof graph !== 'object') return null
  const nodes = (graph as { nodes?: Array<{ id?: string; kind?: string; span?: SerializableSpan }> }).nodes
  if (!Array.isArray(nodes)) return null
  return nodes.find((n) => n.id === moduleName && n.kind === 'module')?.span ?? null
}

export function normalizeHeadingText(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

/** Match a WYSIWYG heading by node title; line number is a last-resort fallback. */
export function findHeadingIndex(
  headings: Array<{ textContent: string | null }>,
  options: { title?: string; line?: number }
): number {
  const title = normalizeHeadingText(options.title)
  if (title) {
    const exact = headings.findIndex((h) => normalizeHeadingText(h.textContent) === title)
    if (exact >= 0) return exact
    const fuzzy = headings.findIndex((h) => {
      const text = normalizeHeadingText(h.textContent)
      return Boolean(text) && (text.includes(title) || title.includes(text))
    })
    if (fuzzy >= 0) return fuzzy
  }
  const line = options.line ?? 0
  if (line > 0 && line <= headings.length) return line - 1
  return -1
}

export function spanForHybridSelection(model: HybridSpanModel, sel: TreeSelection): SerializableSpan | null {
  if (!model || !sel) return null
  const mod = model.modules.find((m) => m.name === sel.moduleName)
  if (!mod) return null
  if (sel.kind === 'process') {
    return mod.processes.find((p) => p.name === sel.processName)?.span ?? null
  }
  if (sel.kind === 'function') {
    return mod.functions.find((f) => f.name === sel.functionName)?.span ?? null
  }
  return mod.span ?? graphNodeSpan(model.moduleGraph, sel.moduleName)
}

export function selectElementText(el: HTMLElement): void {
  const editable = el.closest('[contenteditable="true"]') as HTMLElement | null
  editable?.focus()
  const range = document.createRange()
  range.selectNodeContents(el)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}
