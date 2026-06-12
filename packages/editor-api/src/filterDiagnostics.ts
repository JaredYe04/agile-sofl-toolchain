import type { SerializableSpan } from './span.js'

export type DiagnosticLike = {
  severity: string
  message: string
  span: SerializableSpan
}

export type SelectionFilterInput =
  | {
      kind: 'module' | 'process' | 'function'
      moduleName: string
      processName?: string
      functionName?: string
    }
  | null

export type ModuleSpanIndex = {
  name: string
  span: SerializableSpan
  processes: Array<{ name: string; span: SerializableSpan }>
  functions: Array<{ name: string; span: SerializableSpan }>
}

function spanContains(outer: SerializableSpan, inner: SerializableSpan): boolean {
  return inner.start >= outer.start && inner.end <= outer.end
}

function selectionSpan(
  selection: SelectionFilterInput,
  modules: ModuleSpanIndex[]
): SerializableSpan | null {
  if (!selection) return null
  const mod = modules.find((m) => m.name === selection.moduleName)
  if (!mod) return null
  if (selection.kind === 'module') return mod.span
  if (selection.kind === 'process') {
    return mod.processes.find((p) => p.name === selection.processName)?.span ?? mod.span
  }
  if (selection.kind === 'function') {
    return mod.functions.find((f) => f.name === selection.functionName)?.span ?? mod.span
  }
  return null
}

/** Keep diagnostics whose span falls inside the current module/process/function selection. */
export function filterDiagnosticsBySelection<T extends DiagnosticLike>(
  diagnostics: T[],
  selection: SelectionFilterInput,
  modules: ModuleSpanIndex[]
): T[] {
  const span = selectionSpan(selection, modules)
  if (!span) return diagnostics
  return diagnostics.filter((d) => spanContains(span, d.span))
}
