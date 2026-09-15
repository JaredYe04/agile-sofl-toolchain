import { namesEqual } from './hybridIds.js'

export type ModuleSourceRange = {
  name: string
  start: number
  bodyStart: number
  endModule: number
  end: number
}

const HEADER_RE =
  /(?:^|\n)(?:module|system)\s+(?:SYSTEM_)?([A-Za-z_\u0080-\uFFFF][A-Za-z0-9_\u0080-\uFFFF]*)/gi

export function listModuleHeaders(source: string): Array<{ name: string; start: number }> {
  const headers: Array<{ name: string; start: number }> = []
  const re = new RegExp(HEADER_RE.source, HEADER_RE.flags)
  let match: RegExpExecArray | null
  while ((match = re.exec(source))) {
    const nl = match[0].startsWith('\n') ? 1 : 0
    headers.push({ name: match[1]!, start: match.index + nl })
  }
  return headers
}

function skipLine(source: string, pos: number): number {
  let i = pos
  while (i < source.length && source[i] !== '\n') i += 1
  if (source[i] === '\n') i += 1
  return i
}

function afterOptionalSemi(source: string, pos: number): number {
  let i = pos
  while (i < source.length && /[ \t]/.test(source[i]!)) i += 1
  if (source[i] === ';') i += 1
  while (i < source.length && /[ \t]/.test(source[i]!)) i += 1
  if (source[i] === '\n') i += 1
  return i
}

export function findModuleRange(source: string, moduleName: string): ModuleSourceRange | null {
  const headers = listModuleHeaders(source)
  const idx = headers.findIndex((h) => namesEqual(h.name, moduleName))
  if (idx < 0) return null
  const start = headers[idx]!.start
  const nextStart = headers[idx + 1]?.start ?? source.length
  const window = source.slice(start, nextStart)
  const endRel = window.toLowerCase().lastIndexOf('end_module')
  const endModule = endRel >= 0 ? start + endRel : nextStart
  let bodyStart = skipLine(source, start)
  const headerSemi = source.indexOf(';', start)
  if (headerSemi >= 0 && headerSemi < bodyStart) bodyStart = headerSemi + 1
  while (bodyStart < endModule && /[ \t\r\n]/.test(source[bodyStart]!)) bodyStart += 1
  const endTok = source.slice(endModule).match(/^end_module\s*;?/i)
  const end = endModule + (endTok?.[0].length ?? 'end_module'.length)
  return { name: headers[idx]!.name, start, bodyStart, endModule, end }
}

export function processInsertPoint(source: string, range: ModuleSourceRange): number {
  const body = source.slice(range.bodyStart, range.endModule)
  let last = -1
  const re = /\b(?:end_process|end_function)\b/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(body))) {
    last = match.index + match[0].length
  }
  if (last >= 0) return afterOptionalSemi(source, range.bodyStart + last)
  return range.endModule
}

export function sectionInsertPoint(
  source: string,
  range: ModuleSourceRange,
  keyword: 'const' | 'type' | 'var' | 'inv'
): { at: number; hasSection: boolean; afterKeyword: number } {
  const body = source.slice(range.bodyStart, range.endModule)
  const kw = new RegExp(`(^|\\n)${keyword}\\b`, 'im').exec(body)
  if (kw) {
    const kwAt = range.bodyStart + kw.index + kw[1]!.length
    let afterKeyword = skipLine(source, kwAt)
    const following: Record<typeof keyword, string> = {
      const: 'type|var|inv|gui|process|function|end_module',
      type: 'var|inv|gui|process|function|end_module',
      var: 'inv|gui|process|function|end_module',
      inv: 'const|type|var|gui|process|function|end_module'
    }
    const rest = source.slice(afterKeyword, range.endModule)
    const next = new RegExp(`(^|\\n)(${following[keyword]})\\b`, 'im').exec(rest)
    const sectionEnd = next ? afterKeyword + next.index + next[1]!.length : range.endModule
    let lastLineEnd = afterKeyword
    const lineRe = /[^\n]+\n?/g
    const section = source.slice(afterKeyword, sectionEnd)
    let lineMatch: RegExpExecArray | null
    while ((lineMatch = lineRe.exec(section))) {
      if (lineMatch[0].trim()) lastLineEnd = afterKeyword + lineMatch.index + lineMatch[0].length
    }
    return { at: lastLineEnd, hasSection: true, afterKeyword }
  }
  const following: Record<typeof keyword, string> = {
    const: 'type|var|inv|gui|process|function|end_module',
    type: 'var|inv|gui|process|function|end_module',
    var: 'inv|gui|process|function|end_module',
    inv: 'const|type|var|gui|process|function|end_module'
  }
  const next = new RegExp(`(^|\\n)(${following[keyword]})\\b`, 'im').exec(body)
  const at = next ? range.bodyStart + next.index + next[1]!.length : range.endModule
  return { at, hasSection: false, afterKeyword: at }
}

export function insertLineInSection(
  source: string,
  moduleName: string,
  keyword: 'const' | 'type' | 'var' | 'inv',
  lineText: string
): string | null {
  const range = findModuleRange(source, moduleName)
  if (!range) return null
  const line = lineText.trim().endsWith(';') ? lineText.trim() : `${lineText.trim()};`
  const indented = `  ${line}`
  const point = sectionInsertPoint(source, range, keyword)
  if (point.hasSection) {
    const prefix = point.at > 0 && source[point.at - 1] !== '\n' ? '\n' : ''
    return source.slice(0, point.at) + `${prefix}${indented}\n` + source.slice(point.at)
  }
  const block = `${keyword}\n${indented}\n`
  const prefix = point.at > 0 && source[point.at - 1] !== '\n' ? '\n' : ''
  return source.slice(0, point.at) + `${prefix}${block}` + source.slice(point.at)
}

export function insertInvLine(source: string, moduleName: string, text: string): string | null {
  return insertLineInSection(source, moduleName, 'inv', text)
}

export function scanModuleProcesses(source: string, range: ModuleSourceRange): string[] {
  const body = source.slice(range.bodyStart, range.endModule)
  const names: string[] = []
  const re = /\bprocess\s+(Init|[A-Za-z_\u0080-\uFFFF][A-Za-z0-9_\u0080-\uFFFF]*)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(body))) {
    if (match[1]) names.push(match[1])
  }
  return names
}

export function scanModuleInvariants(source: string, range: ModuleSourceRange): string[] {
  const body = source.slice(range.bodyStart, range.endModule)
  const inv =
    /(^|\n)inv\b([\s\S]*?)(?=\n(?:const|type|var|gui|process|function|end_module)\b|$)/im.exec(body)
  if (!inv) return []
  return inv[2]!
    .split(/\n/)
    .map((l) => l.replace(/;+\s*$/, '').trim())
    .filter((l) => l.length > 0)
}
