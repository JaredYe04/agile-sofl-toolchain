import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

export type InformalSidecarMeta = {
  id?: string
  moduleId?: string
  version?: number
  title?: string
  author?: string
  hybridTarget?: string
  guiTarget?: string
}

export function informalMetaPath(projectRoot: string): string {
  return join(projectRoot, '.agile-sofl', 'informal-meta.json')
}

export function readInformalMeta(projectRoot: string): InformalSidecarMeta | null {
  const file = informalMetaPath(projectRoot)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as InformalSidecarMeta
  } catch {
    return null
  }
}

export function writeInformalMeta(projectRoot: string, meta: InformalSidecarMeta): void {
  const file = informalMetaPath(projectRoot)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(meta, null, 2)}\n`, 'utf-8')
}

export function extractYamlFrontmatter(source: string): {
  meta: InformalSidecarMeta
  body: string
  hadFrontmatter: boolean
} {
  const trimmed = source.trimStart()
  if (!trimmed.startsWith('---')) return { meta: {}, body: source, hadFrontmatter: false }
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
  return {
    hadFrontmatter: true,
    body,
    meta: {
      id: fields.id,
      moduleId: fields.moduleId,
      version: version != null && Number.isFinite(version) ? version : undefined,
      title: fields.title,
      author: fields.author,
      hybridTarget: fields.hybridTarget,
      guiTarget: fields.guiTarget
    }
  }
}

export function inferModuleIdFromAsfl(asfl: string | undefined): string | undefined {
  if (!asfl) return undefined
  const match = asfl.match(/\bmodule\s+SYSTEM_([A-Za-z0-9_]+)/)
  return match?.[1]
}

export function mergeInformalSidecar(
  ...parts: Array<InformalSidecarMeta | null | undefined>
): InformalSidecarMeta {
  const merged: InformalSidecarMeta = {}
  for (const part of parts) {
    if (!part) continue
    if (part.id) merged.id = part.id
    if (part.moduleId) merged.moduleId = part.moduleId
    if (part.version != null) merged.version = part.version
    if (part.title) merged.title = part.title
    if (part.author) merged.author = part.author
    if (part.hybridTarget) merged.hybridTarget = part.hybridTarget
    if (part.guiTarget) merged.guiTarget = part.guiTarget
  }
  return merged
}

export function writeInformalSpecFile(
  projectRoot: string,
  relativePath: string,
  markdown: string,
  extra?: InformalSidecarMeta
): InformalSidecarMeta {
  const extracted = extractYamlFrontmatter(markdown)
  const existing = readInformalMeta(projectRoot)
  const meta = mergeInformalSidecar(
    { id: randomUUID(), version: 1, moduleId: 'project' },
    extracted.meta,
    existing,
    extra
  )
  if (!meta.id) meta.id = randomUUID()
  writeFileSync(join(projectRoot, relativePath), extracted.body.endsWith('\n') ? extracted.body : `${extracted.body}\n`, 'utf-8')
  writeInformalMeta(projectRoot, meta)
  return meta
}

export function migrateInformalSource(
  projectRoot: string,
  source: string,
  extra?: InformalSidecarMeta
): { body: string; meta: InformalSidecarMeta; migrated: boolean } {
  const extracted = extractYamlFrontmatter(source)
  const existing = readInformalMeta(projectRoot)
  const meta = mergeInformalSidecar(
    { id: randomUUID(), version: 1, moduleId: 'project' },
    extracted.meta,
    existing,
    extra
  )
  if (!meta.id) meta.id = randomUUID()
  const needsSidecar = !existing || extracted.hadFrontmatter
  if (needsSidecar) writeInformalMeta(projectRoot, meta)
  return { body: extracted.body, meta, migrated: extracted.hadFrontmatter }
}
