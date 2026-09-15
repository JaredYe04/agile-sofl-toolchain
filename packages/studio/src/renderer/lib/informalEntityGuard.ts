import type { InformalModulePayload } from '../../preload/index'

function norm(s: string | undefined): string {
  return (s ?? '').trim()
}

function invKey(inv: { textHint?: string; description?: string }): string {
  const hint = norm(inv.textHint)
  return hint || norm(inv.description)
}

export function isInformalDuplicate(
  mod: InformalModulePayload,
  kind: 'type' | 'constant' | 'variable' | 'process' | 'function' | 'invariant',
  value: string,
  options?: { excludeId?: string }
): boolean {
  const v = norm(value)
  if (!v) return false
  const match = (items: Array<{ id: string; name?: string }> | undefined) =>
    (items ?? []).some((item) => item.id !== options?.excludeId && norm(item.name) === v)

  if (kind === 'type') return match(mod.types)
  if (kind === 'constant') return match(mod.constants)
  if (kind === 'variable') return match(mod.variables)
  if (kind === 'process') return match(mod.processes)
  if (kind === 'function') return match(mod.functions)
  if (kind === 'invariant') {
    return (mod.invariants ?? []).some(
      (item) => item.id !== options?.excludeId && invKey(item) === v
    )
  }
  return false
}
