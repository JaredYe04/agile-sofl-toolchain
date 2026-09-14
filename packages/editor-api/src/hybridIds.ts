export type HybridIdKind = 'mod' | 'proc' | 'fn' | 'type' | 'var' | 'const' | 'inv' | 'scn' | 'gui'

const KINDS = new Set<HybridIdKind>(['mod', 'proc', 'fn', 'type', 'var', 'const', 'inv', 'scn', 'gui'])

export interface ParsedHybridId {
  kind: HybridIdKind
  id: string
  parts: string[]
  moduleName: string
  entityName?: string
  processName?: string
  screenName?: string
  /** True when the id has no Module.Entity split, e.g. `proc:Login` or `proc:用户与权限`. */
  bare?: boolean
}

export function canonicalModuleName(name: string): string {
  return name.startsWith('SYSTEM_') ? name.slice('SYSTEM_'.length) : name
}

export function namesEqual(a: string, b: string): boolean {
  return canonicalModuleName(a).toLowerCase() === canonicalModuleName(b).toLowerCase()
}

export function slug(text: string): string {
  const parts = text
    .trim()
    .split(/[^A-Za-z0-9\u4e00-\u9fff]+/)
    .filter(Boolean)
  if (parts.length === 0) return 'item'
  return parts
    .map((part) => {
      if (/^[\u4e00-\u9fff]/.test(part)) return part
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join('')
    .slice(0, 64)
}

export function uniqueSlug(text: string, used: Set<string>): string {
  const base = slug(text) || 'item'
  let candidate = base
  let i = 2
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}${i}`
    i += 1
  }
  used.add(candidate.toLowerCase())
  return candidate
}

export function compactLabel(text: string): string {
  return text.replace(/[\s_\-:：]/g, '').toLowerCase()
}

export function labelsMatch(actual: string | undefined, query: string | undefined): boolean {
  if (!actual?.trim() || !query?.trim()) return false
  if (namesEqual(actual, query)) return true
  if (actual.toLowerCase() === query.toLowerCase()) return true
  const sa = slug(actual)
  const sq = slug(query)
  if (sa && sq && sa.toLowerCase() === sq.toLowerCase()) return true
  const ca = compactLabel(actual)
  const cq = compactLabel(query)
  if (!ca || !cq) return false
  if (ca === cq) return true
  const minLen = /[\u4e00-\u9fff]/.test(cq) || /[\u4e00-\u9fff]/.test(ca) ? 2 : 4
  if (Math.min(ca.length, cq.length) < minLen) return false
  return ca.includes(cq) || cq.includes(ca)
}

export function formatHybridId(kind: HybridIdKind, ...parts: string[]): string {
  const next = parts.filter((p) => p != null && String(p).length > 0).map(String)
  if (kind !== 'gui' && next[0]) next[0] = canonicalModuleName(next[0])
  return `${kind}:${next.join('.')}`
}

function stripInformalPrefix(raw: string): string {
  return raw.replace(/^(aspec[_-])?(fn|dr|c)[_-]/i, '').trim()
}

export function parseHybridId(id: string): ParsedHybridId | null {
  const trimmed = id.trim()
  if (!trimmed) return null
  let kind: string
  let rest: string
  const colon = trimmed.indexOf(':')
  if (colon <= 0) {
    const informal = /^(fn|dr|c)[-_]/i.test(trimmed)
    kind = informal ? 'proc' : 'mod'
    rest = stripInformalPrefix(trimmed)
  } else {
    kind = trimmed.slice(0, colon)
    rest = trimmed.slice(colon + 1)
    if (!KINDS.has(kind as HybridIdKind)) {
      if (/^(fn|dr|c)$/i.test(kind)) {
        rest = stripInformalPrefix(`${kind}-${rest}`)
        kind = 'proc'
      } else {
        return null
      }
    }
  }
  if (!rest) return null
  const parts = rest.split('.').filter(Boolean)
  if (parts.length === 0) return null
  const moduleName = parts[0]!
  const parsed: ParsedHybridId = {
    kind: kind as HybridIdKind,
    id: trimmed,
    parts,
    moduleName
  }
  if (kind === 'mod') return parsed
  if (kind === 'scn') {
    parsed.processName = parts[1]
    parsed.entityName = parts.slice(2).join('.') || undefined
    if (parsed.processName && parsed.entityName) return parsed
    if (parts.length === 1) {
      parsed.bare = true
      parsed.entityName = moduleName
      return parsed
    }
    if (parsed.processName && !parsed.entityName) {
      parsed.bare = true
      parsed.entityName = parsed.processName
      return parsed
    }
    return null
  }
  if (kind === 'gui') {
    parsed.screenName = parts.slice(1).join('.') || undefined
    parsed.entityName = parsed.screenName
    if (!parsed.screenName) parsed.bare = true
    return parsed
  }
  parsed.entityName = parts.slice(1).join('.') || undefined
  if (!parsed.entityName) {
    parsed.entityName = moduleName
    parsed.bare = true
  }
  return parsed
}
