import { parse } from '@agile-sofl/parser'
import { namesEqual } from './hybridIds.js'
import { findModuleRange, insertInvLine, sectionInsertPoint } from './moduleSourceRange.js'

function expandLine(source: string, span: { start: number; end: number }): { start: number; end: number } {
  let start = span.start
  while (start > 0 && source[start - 1] !== '\n') start -= 1
  let end = span.end
  while (end < source.length && source[end] !== '\n') end += 1
  if (source[end] === '\n') end += 1
  return { start, end }
}

function stripInvPrefix(text: string): string {
  return text.trim().replace(/^inv\b/i, '').trim()
}

function removeEmptyInvSection(source: string, moduleName: string): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = ast.modules.find((m) => namesEqual(m.name, moduleName))
  if (!mod || mod.invariants.length > 0) return source
  const range = findModuleRange(source, moduleName)
  if (!range) return source
  const point = sectionInsertPoint(source, range, 'inv')
  if (!point.hasSection) return source
  const body = source.slice(range.bodyStart, range.endModule)
  const kw = /(^|\n)([ \t]*inv\b)/im.exec(body)
  if (!kw) return source
  let sectionStart = range.bodyStart + kw.index + kw[1]!.length
  while (sectionStart > range.bodyStart && source[sectionStart - 1] !== '\n') {
    sectionStart -= 1
  }
  let sectionEnd = point.at
  while (sectionEnd < range.endModule && /[ \t\r\n]/.test(source[sectionEnd]!)) {
    sectionEnd += 1
  }
  return (source.slice(0, sectionStart) + source.slice(sectionEnd)).replace(/\n{3,}/g, '\n\n')
}

export function addInvariant(source: string, moduleName: string, text: string): string {
  const line = stripInvPrefix(text) || 'true'
  return insertInvLine(source, moduleName, line) ?? source
}

export function removeInvariantInModule(
  source: string,
  moduleName: string,
  span: { start: number; end: number }
): string {
  const line = expandLine(source, span)
  const next = (source.slice(0, line.start) + source.slice(line.end)).replace(/\n{3,}/g, '\n\n')
  return removeEmptyInvSection(next, moduleName)
}

export function removeInvariantByIndex(source: string, moduleName: string, index: number): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = ast.modules.find((m) => namesEqual(m.name, moduleName))
  const inv = mod?.invariants[index]
  if (!inv) return source
  return removeInvariantInModule(source, moduleName, inv.span)
}

export function reorderInvariants(
  source: string,
  moduleName: string,
  fromIndex: number,
  toIndex: number
): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = ast.modules.find((m) => namesEqual(m.name, moduleName))
  if (!mod || fromIndex === toIndex) return source
  const invs = mod.invariants
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= invs.length || toIndex >= invs.length) return source
  const texts = invs.map((inv) => source.slice(inv.span.start, inv.span.end).trim())
  const [moved] = texts.splice(fromIndex, 1)
  if (!moved) return source
  texts.splice(toIndex, 0, moved)
  const range = findModuleRange(source, moduleName)
  if (!range) return source
  const point = sectionInsertPoint(source, range, 'inv')
  if (!point.hasSection) return source
  const body = texts
    .map((t) => {
      const line = stripInvPrefix(t)
      return `  ${line.endsWith(';') ? line : `${line};`}`
    })
    .join('\n')
  return `${source.slice(0, point.afterKeyword)}${body}\n${source.slice(point.at)}`
}
