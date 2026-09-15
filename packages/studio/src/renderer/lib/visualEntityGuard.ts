import type { VisualModuleSummary } from '../../preload/index'
import { namesEqual } from '@agile-sofl/editor-api'

export type VisualEntityKind =
  | 'module'
  | 'const'
  | 'type'
  | 'var'
  | 'process'
  | 'function'
  | 'invariant'

function normalizeInv(text: string): string {
  return text.replace(/^inv\b/i, '').replace(/;+\s*$/, '').trim()
}

export function isDuplicateInModule(
  module: VisualModuleSummary,
  kind: VisualEntityKind,
  value: string,
  options?: { excludeName?: string; excludeInvariantIndex?: number }
): boolean {
  const v = value.trim()
  if (!v) return false
  if (kind === 'const') {
    return module.consts.some((c) => c.name === v && c.name !== options?.excludeName)
  }
  if (kind === 'type') {
    return module.types.some((t) => t.name === v && t.name !== options?.excludeName)
  }
  if (kind === 'var') {
    return module.vars.some((x) => x.name === v && x.name !== options?.excludeName)
  }
  if (kind === 'process') {
    return module.processes.some((p) => p.name === v && p.name !== options?.excludeName)
  }
  if (kind === 'function') {
    return module.functions.some((f) => f.name === v && f.name !== options?.excludeName)
  }
  if (kind === 'invariant') {
    const key = normalizeInv(v)
    return module.invariants.some((inv, i) => {
      if (options?.excludeInvariantIndex === i) return false
      return normalizeInv(inv.text) === key
    })
  }
  return false
}

export function isDuplicateModuleName(
  modules: VisualModuleSummary[],
  name: string,
  excludeModuleName?: string
): boolean {
  const v = name.trim()
  if (!v) return false
  return modules.some((m) => namesEqual(m.name, v) && !namesEqual(m.name, excludeModuleName ?? ''))
}
