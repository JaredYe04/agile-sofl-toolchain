import { parse } from '@agile-sofl/parser'
import { listModuleHeaders } from './moduleSourceRange.js'

const GUI_MODULE_NAME = /^GUI_/i

/**
 * Agent source edits often emit a one-line GUI placeholder:
 *   module GUI_App / SYSTEM_Shop;
 * without end_module, or with :, ~, % instead of /. The released parser rejects these.
 */
export function repairGuiModuleStub(source: string): { text: string; notes: string[] } {
  const notes: string[] = []
  let text = normalizeGuiHeaderLines(source, notes)
  text = closeIncompleteGuiModules(text, notes)
  return { text, notes: [...new Set(notes)] }
}

export function isGuiModuleStubIssue(source: string): boolean {
  const { text } = repairGuiModuleStub(source)
  if (text !== source) return true
  return detectOpenGuiModules(source).length > 0
}

/** GUI module headers with no end_module before the next module or EOF. */
export function detectOpenGuiModules(source: string): string[] {
  const headers = listModuleHeaders(source)
  const open: string[] = []
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]!
    if (!GUI_MODULE_NAME.test(h.name)) continue
    const end = headers[i + 1]?.start ?? source.length
    const window = source.slice(h.start, end)
    if (!/\bend_module\b/i.test(window)) open.push(h.name)
  }
  return open
}

function normalizeGuiHeaderLines(source: string, notes: string[]): string {
  const lines = source.split('\n')
  let changed = false
  const out = lines.map((line) => {
    const next = normalizeGuiHeaderLine(line)
    if (next.changed) {
      changed = true
      if (next.note) notes.push(next.note)
    }
    return next.line
  })
  return changed ? out.join('\n') : source
}

function normalizeGuiHeaderLine(line: string): { line: string; changed: boolean; note?: string } {
  const m = line.match(/^(\s*(?:module|system)\s+GUI_[A-Za-z_\u0080-\uFFFF][A-Za-z0-9_\u0080-\uFFFF]*\s*)(.*)$/i)
  if (!m) return { line, changed: false }
  const prefix = m[1]!
  let suffix = (m[2] ?? '').trim()
  let changed = false
  const noteParts: string[] = []

  if (/%/.test(suffix)) {
    suffix = suffix.replace(/%/g, '')
    changed = true
    noteParts.push('removed %')
  }
  if (/^[:~]/.test(suffix)) {
    suffix = suffix.replace(/^[:~]\s*/, '/ ')
    changed = true
    noteParts.push('rewrote parent separator to /')
  }
  const parent = suffix.match(/^\/\s*(?:SYSTEM_)?([A-Za-z_\u0080-\uFFFF][A-Za-z0-9_\u0080-\uFFFF]*)\s*;?\s*$/i)
  if (parent && /SYSTEM_/i.test(suffix)) {
    suffix = `/ ${parent[1]};`
    changed = true
    noteParts.push('stripped SYSTEM_ from GUI parent')
  }
  if (suffix && !suffix.endsWith(';')) {
    suffix = `${suffix.replace(/;?\s*$/, '')};`
    changed = true
  }
  if (!suffix) {
    changed = true
    return {
      line: `${prefix.trimEnd()};`,
      changed: true,
      note: 'normalized bare GUI module header'
    }
  }
  if (!changed) return { line, changed: false }
  return {
    line: `${prefix}${suffix}`,
    changed: true,
    note: noteParts.length ? `GUI header: ${noteParts.join(', ')}` : 'normalized GUI module header'
  }
}

function closeIncompleteGuiModules(source: string, notes: string[]): string {
  let text = source
  for (let pass = 0; pass < 8; pass++) {
    const headers = listModuleHeaders(text)
    let inserted = false
    for (let i = headers.length - 1; i >= 0; i--) {
      const h = headers[i]!
      if (!GUI_MODULE_NAME.test(h.name)) continue
      const end = headers[i + 1]?.start ?? text.length
      const window = text.slice(h.start, end)
      if (/\bend_module\b/i.test(window)) continue
      const insertAt = end
      text = `${text.slice(0, insertAt)}\nend_module${text.slice(insertAt)}`
      notes.push(`Closed incomplete GUI module ${h.name} with end_module.`)
      inserted = true
      break
    }
    if (!inserted) break
  }
  return text
}

/** True when the released parser accepts the full program after stub repair. */
export function guiStubBlocksParse(source: string): boolean {
  const { ast, diagnostics } = parse(source)
  if (ast?.type === 'program' && !diagnostics.some((d) => d.severity === 'error')) return false
  const repaired = repairGuiModuleStub(source)
  const after = parse(repaired.text)
  return (
    after.ast?.type === 'program' &&
    !after.diagnostics.some((d) => d.severity === 'error') &&
    repaired.text !== source
  )
}
