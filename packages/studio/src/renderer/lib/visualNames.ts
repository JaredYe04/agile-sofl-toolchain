/** Allocate numbered identifiers that do not collide with existing names (case-sensitive). */
export function nextNumberedName(prefix: string, existing: string[]): string {
  const used = new Set(existing.map((n) => n.trim()).filter(Boolean))
  let n = 1
  while (used.has(`${prefix}${n}`)) n += 1
  return `${prefix}${n}`
}

export function nextTypeName(existingTypeNames: string[]): string {
  return nextNumberedName('Type', existingTypeNames)
}

export function nextVarName(existingVarNames: string[]): string {
  return nextNumberedName('var', existingVarNames)
}

export function nextConstName(existingConstNames: string[]): string {
  return nextNumberedName('Const', existingConstNames)
}

export function nextProcessName(existingProcessNames: string[]): string {
  return nextNumberedName('Process', existingProcessNames)
}

/** Valid, distinct placeholder predicates for new invariants. */
export function nextInvariantPlaceholder(existingTexts: string[]): string {
  const normalized = new Set(
    existingTexts.map((t) => t.replace(/^inv\b/i, '').replace(/;+\s*$/, '').trim())
  )
  let n = 1
  for (;;) {
    const candidate = `${n} <= ${n}`
    if (!normalized.has(candidate)) return candidate
    n += 1
  }
}

export function constDeclText(name: string, value = '0'): string {
  return `${name.trim()} = ${value}`
}
