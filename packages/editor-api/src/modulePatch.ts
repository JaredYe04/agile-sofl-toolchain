import { parse, type ModuleNode, type ProgramNode } from '@agile-sofl/parser'
import { findModuleRange } from './moduleSourceRange.js'

export type ModulePatchAction = 'add' | 'remove' | 'rename'

function normalizeModuleName(name: string): string {
  return name.startsWith('SYSTEM_') ? name.slice('SYSTEM_'.length) : name
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findModule(ast: ProgramNode, moduleName: string): ModuleNode | undefined {
  const bare = normalizeModuleName(moduleName)
  return ast.modules.find((m) => m.name === bare || m.name === moduleName)
}

function moduleBlockSpan(source: string, mod: ModuleNode): { start: number; end: number } {
  const endKw = source.lastIndexOf('end_module', mod.span.end)
  let end = endKw >= 0 ? endKw + 'end_module'.length : mod.span.end
  if (source[end] === ';') end++
  if (source[end] === '\n') end++
  return { start: mod.span.start, end }
}

function identPattern(name: string): string {
  return escapeRegExp(normalizeModuleName(name))
}

/** Drop `/ Removed` from remaining module headers after a parent is deleted. */
export function stripOrphanParents(source: string, removedName: string): string {
  const bare = identPattern(removedName)
  if (!bare) return source
  const re = new RegExp(
    `(module\\s+(?:SYSTEM_)?[A-Za-z_\\u0080-\\uFFFF][A-Za-z0-9_\\u0080-\\uFFFF]*)\\s*/\\s*(?:SYSTEM_)?${bare}(\\s*;)`,
    'gi'
  )
  return source.replace(re, '$1$2')
}

export function setModuleParent(source: string, moduleName: string, parentName: string | null): string {
  const range = findModuleRange(source, moduleName)
  if (!range) return source
  const header = source.slice(range.start, range.bodyStart)
  const parent = parentName?.trim() ? normalizeModuleName(parentName) : ''
  const replaced = header.replace(
    /^(module|system)(\s+)((?:SYSTEM_)?[A-Za-z_\u0080-\uFFFF][A-Za-z0-9_\u0080-\uFFFF]*)(\s*\/\s*[A-Za-z_\u0080-\uFFFF][A-Za-z0-9_\u0080-\uFFFF]*)?(\s*;?)/i,
    (_m, kw: string, sp: string, name: string, _oldParent: string | undefined, semi: string) => {
      const isSystemHeader = /^system$/i.test(kw) || /SYSTEM_/i.test(name)
      const nextParent = parent && !isSystemHeader ? ` / ${parent}` : ''
      return `${kw}${sp}${name}${nextParent}${semi ?? ''}`
    }
  )
  if (replaced === header) return source
  return source.slice(0, range.start) + replaced + source.slice(range.bodyStart)
}

export function addModule(
  source: string,
  moduleName: string,
  options?: { parentName?: string; isSystem?: boolean }
): string {
  const bare = normalizeModuleName(moduleName)
  const existing = findModuleRange(source, moduleName) ?? findModuleRange(source, bare)
  if (existing) {
    if (options?.parentName) return setModuleParent(source, existing.name, options.parentName)
    return source
  }
  const isSystem = Boolean(options?.isSystem || moduleName.startsWith('SYSTEM_'))
  const header = isSystem
    ? `module SYSTEM_${bare};`
    : options?.parentName
      ? `module ${bare} / ${options.parentName};`
      : `module ${bare};`
  const block = `${header}\nend_module`
  const trimmed = source.trimEnd()
  const hadDot = trimmed.endsWith('.')
  const body = hadDot ? trimmed.slice(0, -1).trimEnd() : trimmed
  if (isSystem) {
    const next = body ? `${block};\n${body}` : block
    return hadDot ? `${next}\n.` : next
  }
  const separated = body && !/[;.]\s*$/.test(body) ? `${body};` : body
  const next = separated ? `${separated}\n${block}` : block
  return hadDot ? `${next}\n.` : next
}

export function removeModule(source: string, moduleName: string): string {
  const range = findModuleRange(source, moduleName)
  if (range) {
    let end = range.end
    if (source[end] === '\n') end += 1
    let next = source.slice(0, range.start) + source.slice(end)
    next = stripOrphanParents(next, range.name)
    next = next.replace(/\n{3,}/g, '\n\n').trimEnd()
    return /^[.;\s]*$/.test(next) ? '' : next
  }
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, moduleName)
  if (!mod) return source
  const span = moduleBlockSpan(source, mod)
  let next = source.slice(0, span.start) + source.slice(span.end)
  next = stripOrphanParents(next, mod.name)
  next = next.replace(/\n{3,}/g, '\n\n').trimEnd()
  return /^[.;\s]*$/.test(next) ? '' : next
}

export function renameModule(source: string, moduleName: string, newName: string): string {
  const range = findModuleRange(source, moduleName)
  if (range) {
    const header = source.slice(range.start, range.bodyStart)
    const bare = normalizeModuleName(newName)
    const replaced = header.replace(
      /((?:module|system)\s+)(?:SYSTEM_)?([A-Za-z_\u0080-\uFFFF][A-Za-z0-9_\u0080-\uFFFF]*)/i,
      (_m, prefix: string, old: string) => {
        const keepSys = /SYSTEM_/i.test(header) || /^SYSTEM_/i.test(newName)
        return `${prefix}${keepSys ? 'SYSTEM_' : ''}${bare || old}`
      }
    )
    if (replaced !== header) {
      return source.slice(0, range.start) + replaced + source.slice(range.bodyStart)
    }
  }
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, moduleName)
  if (!mod?.nameSpan) return source
  const bare = normalizeModuleName(newName)
  return source.slice(0, mod.nameSpan.start) + bare + source.slice(mod.nameSpan.end)
}

export function patchModule(
  source: string,
  payload: {
    action: ModulePatchAction
    moduleName: string
    newName?: string
    parentName?: string
    isSystem?: boolean
  }
): string {
  const { action, moduleName, newName, parentName, isSystem } = payload
  if (action === 'add') return addModule(source, moduleName, { parentName, isSystem })
  if (action === 'remove') return removeModule(source, moduleName)
  if (action === 'rename' && newName) return renameModule(source, moduleName, newName)
  return source
}
