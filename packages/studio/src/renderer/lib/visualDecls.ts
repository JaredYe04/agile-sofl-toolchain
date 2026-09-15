export const BASIC_TYPES = ['nat', 'nat0', 'int', 'real', 'bool', 'string', 'char']

export type TypeFieldDraft = { name: string; type: string }

export function composedTypeText(name: string, fields: TypeFieldDraft[]): string {
  const parts = fields
    .filter((f) => f.name.trim())
    .map((f) => `${f.name.trim()}: ${f.type.trim() || 'nat'}`)
  const body = parts.length ? parts.join(' ') : 'field_1: nat'
  return `${name.trim()} = composed of ${body} end`
}

export function aliasTypeText(name: string, expr: string): string {
  return `${name.trim()} = ${expr.trim() || 'nat'}`
}

export function typeExpressionOf(text: string): string {
  const trimmed = text.replace(/;+\s*$/, '').trim()
  const eq = trimmed.indexOf('=')
  if (eq < 0) return trimmed
  return trimmed.slice(eq + 1).trim()
}

export function nextFieldName(fields: TypeFieldDraft[]): string {
  let n = fields.length + 1
  const used = new Set(fields.map((f) => f.name))
  while (used.has(`field_${n}`)) n += 1
  return `field_${n}`
}

export function parseVarText(text: string): { name: string; type: string } {
  const trimmed = text.replace(/;+\s*$/, '').trim()
  const m = trimmed.match(/^([^:=]+?)\s*:\s*(.+)$/)
  if (m) return { name: m[1]!.trim(), type: m[2]!.trim() }
  return { name: trimmed || 'newVar', type: 'nat' }
}

export function varDeclText(name: string, type: string): string {
  return `${name.trim()}: ${type.trim() || 'nat'}`
}
