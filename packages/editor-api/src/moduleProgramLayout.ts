import { parse } from '@agile-sofl/parser'
import { listModuleHeaders } from './moduleSourceRange.js'

const ORPHAN_AFTER_DOT =
  /^([\s\S]*?\.\s*\n\s*)((?:module|system)\s[\s\S]*)$/i

/** Detect module headers that sit after the program's closing dot (invisible to the parser). */
export function hybridSuffixAfterProgramDot(source: string): string | null {
  const trimmed = source.trimEnd()
  if (!ORPHAN_AFTER_DOT.test(trimmed)) return null
  return 'Hybrid source has module text after the program dot (.); released parsers ignore it'
}

/**
 * Move module blocks that were appended after the program dot (common GUI_App stub mistake)
 * to before the dot, matching addModule() layout.
 */
export function integrateOrphanModulesAfterProgramDot(source: string): { text: string; notes: string[] } {
  const notes: string[] = []
  const trimmed = source.trimEnd()
  const match = trimmed.match(ORPHAN_AFTER_DOT)
  if (!match) return { text: source, notes }
  const body = match[1]!.trimEnd().replace(/\.\s*$/, '').trimEnd()
  const orphan = match[2]!.trim()
  if (!orphan) return { text: source, notes }
  const separated = body && !/[;.]\s*$/.test(body) ? `${body};` : body
  const next = `${separated}\n${orphan}\n.`
  notes.push('Moved module text that appeared after the program dot into the Hybrid program.')
  return { text: next, notes }
}

/** Insert new text before a trailing program dot, like addModule(). */
export function insertHybridTextBeforeProgramDot(source: string, insert: string): string {
  const trimmed = source.trimEnd()
  if (!insert.trim()) return source
  const hadDot = trimmed.endsWith('.')
  const body = hadDot ? trimmed.slice(0, -1).trimEnd() : trimmed
  const separated = body && !/[;.]\s*$/.test(body) ? `${body};` : body
  const block = insert.trimEnd()
  const next = separated ? `${separated}\n${block}` : block
  return hadDot ? `${next}\n.` : next
}

/** Headers present in source but missing from the parsed program AST (e.g. after-program-dot orphans). */
export function orphanModuleHeaders(source: string): string[] {
  const trimmed = source.trimEnd()
  const headers = listModuleHeaders(trimmed)
  if (!headers.length) return []
  const { ast } = parse(trimmed)
  if (!ast || ast.type !== 'program') return headers.map((h) => h.name)
  const parsed = new Set(ast.modules.map((m) => m.name))
  return headers.filter((h) => !parsed.has(h.name)).map((h) => h.name)
}
