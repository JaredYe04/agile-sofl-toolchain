export function nextIndexedTitle(existing: string[], prefix: string): string {
  const used = new Set<number>()
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^${escaped}(\\d+)$`)
  for (const title of existing) {
    const match = title.trim().match(re)
    if (match) used.add(Number(match[1]))
  }
  let n = 1
  while (used.has(n)) n += 1
  return `${prefix}${n}`
}

export function duplicateTitle(title: string, suffix: string): string {
  const base = title.trim() || 'Item'
  if (base.endsWith(suffix)) return `${base} 2`
  return `${base}${suffix}`
}
