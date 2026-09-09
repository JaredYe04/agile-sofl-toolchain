import type { InformalSpecification } from './model.js'

export type AspecSourceFormat = 'yaml' | 'markdown'

export type InformalMeta = {
  id?: string
  moduleId?: string
  version?: number
  title?: string
  author?: string
  hybridTarget?: string
  guiTarget?: string
}

export function detectAspecFormat(source: string): AspecSourceFormat {
  const head = source.slice(0, 2500)
  if (/^aspecVersion\s*:/m.test(head) && /^(meta|system|modules)\s*:/m.test(head)) {
    return 'yaml'
  }
  return 'markdown'
}

export function extractInformalFrontmatter(source: string): {
  meta: InformalMeta
  body: string
  hadFrontmatter: boolean
} {
  const trimmed = source.trimStart()
  if (!trimmed.startsWith('---')) {
    return { meta: {}, body: source, hadFrontmatter: false }
  }
  const end = trimmed.indexOf('\n---', 3)
  if (end < 0) return { meta: {}, body: source, hadFrontmatter: false }
  const raw = trimmed.slice(4, end).trim()
  const body = trimmed.slice(end + 4).replace(/^(?:\r?\n)+/, '')
  const fields: Record<string, string> = {}
  for (const line of raw.split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key) fields[key] = value
  }
  const version = fields.version != null ? Number(fields.version) : undefined
  const meta: InformalMeta = {
    id: fields.id,
    moduleId: fields.moduleId,
    version: version != null && Number.isFinite(version) ? version : undefined,
    title: fields.title,
    author: fields.author,
    hybridTarget: fields.hybridTarget,
    guiTarget: fields.guiTarget
  }
  return { meta, body, hadFrontmatter: true }
}

export function applyInformalMeta(spec: InformalSpecification, meta: InformalMeta): InformalSpecification {
  if (meta.id) spec.id = meta.id
  if (meta.moduleId) spec.moduleId = meta.moduleId
  if (meta.version != null && Number.isFinite(meta.version)) spec.version = meta.version
  spec.metadata = {
    ...spec.metadata,
    ...(meta.title ? { title: meta.title } : {}),
    ...(meta.author ? { author: meta.author } : {}),
    ...(meta.hybridTarget ? { hybridTarget: meta.hybridTarget } : {}),
    ...(meta.guiTarget ? { guiTarget: meta.guiTarget } : {})
  }
  return spec
}

/** Remove legacy `<!-- @id:... -->` markers from user-facing markdown. */
export function stripInformalIdComments(markdown: string): string {
  const next = markdown
    .replace(/[ \t]*<!--\s*@id:[^>]*-->/gi, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return next ? `${next}\n` : ''
}
