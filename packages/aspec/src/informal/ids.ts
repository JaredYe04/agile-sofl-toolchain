const PREFIX: Record<string, string> = {
  function: 'fn',
  'data-resource': 'dr',
  'data-field': 'df',
  constraint: 'c',
  text: 'tx',
  functions: 'sec-fn',
  'data-resources': 'sec-dr',
  constraints: 'sec-c'
}

export function slugify(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || 'node'
}

export function toIdent(title: string): string {
  const parts = title
    .trim()
    .split(/[^A-Za-z0-9\u4e00-\u9fff]+/)
    .filter(Boolean)
  if (parts.length === 0) return 'Item'
  return parts
    .map((p, i) => {
      if (/^[\u4e00-\u9fff]/.test(p)) return p
      const lower = p.toLowerCase()
      if (i === 0) return lower.charAt(0).toUpperCase() + lower.slice(1)
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join('')
}

export function toSnakeIdent(title: string): string {
  const slug = slugify(title).replace(/-/g, '_')
  return slug.replace(/[^\w]/g, '_') || 'item'
}

export function createNodeId(type: string, title: string, used: Set<string>): string {
  const prefix = PREFIX[type] ?? 'n'
  const base = `${prefix}-${slugify(title)}`
  if (!used.has(base)) {
    used.add(base)
    return base
  }
  let i = 2
  while (used.has(`${base}-${i}`)) i += 1
  const id = `${base}-${i}`
  used.add(id)
  return id
}

export function createSpecId(): string {
  return `spec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
