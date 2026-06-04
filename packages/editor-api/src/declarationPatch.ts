import { parse, type ModuleNode, type ProgramNode } from '@agile-sofl/parser'

export type DeclarationKind = 'const' | 'type' | 'var'

function replaceSpan(source: string, span: { start: number; end: number }, replacement: string): string {
  return source.slice(0, span.start) + replacement + source.slice(span.end)
}

function normalizeModuleName(name: string): string {
  return name.startsWith('SYSTEM_') ? name.slice('SYSTEM_'.length) : name
}

function findModule(ast: ProgramNode, moduleName: string): ModuleNode | undefined {
  const bare = normalizeModuleName(moduleName)
  return ast.modules.find((m) => m.name === bare || m.name === moduleName)
}

function moduleHeaderEnd(source: string, mod: ModuleNode): number {
  const semi = source.indexOf(';', mod.span.start)
  return semi >= 0 ? semi + 1 : mod.span.start
}

function sectionKeywordIndex(source: string, mod: ModuleNode, keyword: DeclarationKind): number {
  const bodyStart = moduleHeaderEnd(source, mod)
  const slice = source.slice(bodyStart, mod.span.end)
  const match = new RegExp(`(^|\\n)${keyword}\\s*\\n`, 'm').exec(slice)
  return match ? bodyStart + match.index + match[1].length : -1
}

function ensureTrailingSemicolon(text: string): string {
  const trimmed = text.trim()
  return trimmed.endsWith(';') ? trimmed : `${trimmed};`
}

function indentLine(text: string, spaces = 2): string {
  return `${' '.repeat(spaces)}${text.trim()}`
}

function removeSectionIfEmpty(
  source: string,
  mod: ModuleNode,
  keyword: DeclarationKind,
  items: { span: { start: number; end: number } }[]
): string {
  if (items.length > 0) return source
  const kw = sectionKeywordIndex(source, mod, keyword)
  if (kw < 0) return source
  const afterKw = kw + keyword.length
  let end = afterKw
  while (end < source.length && source[end] !== '\n') {
    end += 1
  }
  if (source[end] === '\n') end++
  return replaceSpan(source, { start: kw, end }, '')
}

function insertIntoSection(
  source: string,
  mod: ModuleNode,
  keyword: DeclarationKind,
  items: { span: { start: number; end: number } }[],
  lineText: string
): string {
  const line = ensureTrailingSemicolon(lineText)
  if (items.length === 0) {
    const at = moduleHeaderEnd(source, mod)
    const block = `\n${keyword}\n${indentLine(line)}\n`
    return source.slice(0, at) + block + source.slice(at)
  }
  const last = items[items.length - 1]
  const insertAt = last.span.end
  return source.slice(0, insertAt) + `\n${indentLine(line)}` + source.slice(insertAt)
}

function replaceDeclLine(source: string, span: { start: number; end: number }, lineText: string): string {
  let lineStart = span.start
  while (lineStart > 0 && source[lineStart - 1] !== '\n') {
    lineStart -= 1
  }
  let lineEnd = span.end
  while (lineEnd < source.length && source[lineEnd] !== '\n') {
    lineEnd += 1
  }
  const indent = source.slice(lineStart, span.start).match(/^(\s*)/)?.[1] ?? '  '
  const line = ensureTrailingSemicolon(lineText.trim())
  return source.slice(0, lineStart) + indent + line + source.slice(lineEnd)
}

function patchDeclLine(
  source: string,
  moduleName: string,
  _kind: DeclarationKind,
  _name: string,
  lineText: string,
  match: (mod: ModuleNode) => { name: string; span: { start: number; end: number } } | undefined
): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, moduleName)
  if (!mod) return source
  const item = match(mod)
  if (!item) return source
  return replaceDeclLine(source, item.span, lineText)
}

function removeDeclLine(
  source: string,
  moduleName: string,
  kind: DeclarationKind,
  name: string,
  items: (mod: ModuleNode) => { name: string; span: { start: number; end: number } }[],
  matchName: (item: { name: string }, n: string) => boolean
): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, moduleName)
  if (!mod) return source
  const list = items(mod)
  const item = list.find((i) => matchName(i, name))
  if (!item) return source
  let lineStart = item.span.start
  while (lineStart > 0 && source[lineStart - 1] !== '\n') {
    lineStart -= 1
  }
  let lineEnd = item.span.end
  while (lineEnd < source.length && source[lineEnd] !== '\n') {
    lineEnd += 1
  }
  if (source[lineEnd] === '\n') lineEnd++
  let next = source.slice(0, lineStart) + source.slice(lineEnd)
  next = next.replace(/\n{3,}/g, '\n\n')
  const remaining = list.filter((i) => i.name !== item.name)
  return removeSectionIfEmpty(next, mod, kind, remaining.map((r) => ({ span: r.span })))
}

export function patchConst(source: string, moduleName: string, constName: string, lineText: string): string {
  return patchDeclLine(source, moduleName, 'const', constName, lineText, (mod) => {
    const c = mod.consts.find((x) => x.name === constName)
    return c ? { name: c.name, span: c.span } : undefined
  })
}

export function addConst(source: string, moduleName: string, lineText: string): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, moduleName)
  if (!mod) return source
  return insertIntoSection(
    source,
    mod,
    'const',
    mod.consts.map((c) => ({ span: c.span })),
    lineText
  )
}

export function removeConst(source: string, moduleName: string, constName: string): string {
  return removeDeclLine(
    source,
    moduleName,
    'const',
    constName,
    (mod) => mod.consts.map((c) => ({ name: c.name, span: c.span })),
    (item, n) => item.name === n
  )
}

export function patchType(source: string, moduleName: string, typeName: string, lineText: string): string {
  return patchDeclLine(source, moduleName, 'type', typeName, lineText, (mod) => {
    const t = mod.types.find((x) => x.name === typeName)
    return t ? { name: t.name, span: t.span } : undefined
  })
}

export function addType(source: string, moduleName: string, lineText: string): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, moduleName)
  if (!mod) return source
  return insertIntoSection(
    source,
    mod,
    'type',
    mod.types.map((t) => ({ span: t.span })),
    lineText
  )
}

export function removeType(source: string, moduleName: string, typeName: string): string {
  return removeDeclLine(
    source,
    moduleName,
    'type',
    typeName,
    (mod) => mod.types.map((t) => ({ name: t.name, span: t.span })),
    (item, n) => item.name === n
  )
}

export function patchVar(source: string, moduleName: string, varName: string, lineText: string): string {
  return patchDeclLine(source, moduleName, 'var', varName, lineText, (mod) => {
    const v = mod.vars.find((x) => x.variable.name === varName)
    return v ? { name: v.variable.name, span: v.span } : undefined
  })
}

export function addVar(source: string, moduleName: string, lineText: string): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, moduleName)
  if (!mod) return source
  return insertIntoSection(
    source,
    mod,
    'var',
    mod.vars.map((v) => ({ span: v.span })),
    lineText
  )
}

export function removeVar(source: string, moduleName: string, varName: string): string {
  return removeDeclLine(
    source,
    moduleName,
    'var',
    varName,
    (mod) => mod.vars.map((v) => ({ name: v.variable.name, span: v.span })),
    (item, n) => item.name === n
  )
}

export function patchDeclaration(
  source: string,
  payload: {
    moduleName: string
    kind: DeclarationKind
    action: 'patch' | 'add' | 'remove'
    name?: string
    text?: string
  }
): string {
  const { moduleName, kind, action, name, text } = payload
  switch (kind) {
    case 'const':
      if (action === 'add') return addConst(source, moduleName, text ?? 'NewConst = 0')
      if (action === 'remove' && name) return removeConst(source, moduleName, name)
      if (action === 'patch' && name && text) return patchConst(source, moduleName, name, text)
      break
    case 'type':
      if (action === 'add') return addType(source, moduleName, text ?? 'NewType = nat')
      if (action === 'remove' && name) return removeType(source, moduleName, name)
      if (action === 'patch' && name && text) return patchType(source, moduleName, name, text)
      break
    case 'var':
      if (action === 'add') return addVar(source, moduleName, text ?? 'newVar: nat')
      if (action === 'remove' && name) return removeVar(source, moduleName, name)
      if (action === 'patch' && name && text) return patchVar(source, moduleName, name, text)
      break
  }
  return source
}
