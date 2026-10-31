import type { SerializableSpan } from '../../preload/index'
import type { TreeSelection } from '../composables/useVisualModel'

export type HybridSpanModel = {
  modules: Array<{
    name: string
    span?: SerializableSpan
    cdfdSpan?: SerializableSpan
    processes: Array<{ name: string; span?: SerializableSpan }>
    functions: Array<{ name: string; span?: SerializableSpan }>
    types?: Array<{ name: string; span?: SerializableSpan }>
    vars?: Array<{ name: string; span?: SerializableSpan }>
    consts?: Array<{ name: string; span?: SerializableSpan }>
    invariants?: Array<{ span?: SerializableSpan }>
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
  if (sel.kind === 'type') return mod.types?.find((item) => item.name === sel.name)?.span ?? null
  if (sel.kind === 'var') return mod.vars?.find((item) => item.name === sel.name)?.span ?? null
  if (sel.kind === 'const') return mod.consts?.find((item) => item.name === sel.name)?.span ?? null
  if (sel.kind === 'inv') return mod.invariants?.[sel.index]?.span ?? null
  if (sel.kind === 'cdfd') return mod.cdfdSpan ?? null
  return mod.span ?? graphNodeSpan(model.moduleGraph, sel.moduleName)
}

export function sameSelection(a: TreeSelection, b: TreeSelection): boolean {
  if (a === b) return true
  if (!a || !b || a.kind !== b.kind || a.moduleName !== b.moduleName) return false
  if (a.kind === 'process' && b.kind === 'process') return a.processName === b.processName
  if (a.kind === 'function' && b.kind === 'function') return a.functionName === b.functionName
  if (a.kind === 'type' && b.kind === 'type') return a.name === b.name
  if (a.kind === 'var' && b.kind === 'var') return a.name === b.name
  if (a.kind === 'const' && b.kind === 'const') return a.name === b.name
  if (a.kind === 'inv' && b.kind === 'inv') return a.index === b.index
  return a.kind === 'module' || a.kind === 'cdfd'
}

/** Innermost entity whose span contains the source offset. */
export function selectionAtOffset(model: HybridSpanModel, offset: number): TreeSelection {
  if (!model) return null
  let best: { sel: TreeSelection; size: number } | null = null
  const consider = (span: SerializableSpan | undefined, sel: TreeSelection) => {
    if (!span || !sel || offset < span.start || offset > span.end) return
    const size = Math.max(0, span.end - span.start)
    if (!best || size <= best.size) best = { sel, size }
  }
  for (const mod of model.modules) {
    consider(mod.span, { kind: 'module', moduleName: mod.name })
    for (const item of mod.types ?? []) consider(item.span, { kind: 'type', moduleName: mod.name, name: item.name })
    for (const item of mod.consts ?? []) consider(item.span, { kind: 'const', moduleName: mod.name, name: item.name })
    for (const item of mod.vars ?? []) consider(item.span, { kind: 'var', moduleName: mod.name, name: item.name })
    ;(mod.invariants ?? []).forEach((item, index) =>
      consider(item.span, { kind: 'inv', moduleName: mod.name, index })
    )
    for (const item of mod.functions) consider(item.span, { kind: 'function', moduleName: mod.name, functionName: item.name })
    for (const item of mod.processes) consider(item.span, { kind: 'process', moduleName: mod.name, processName: item.name })
    consider(mod.cdfdSpan, { kind: 'cdfd', moduleName: mod.name })
  }
  return best?.sel ?? null
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
