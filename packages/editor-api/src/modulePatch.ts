import { parse, type ModuleNode, type ProgramNode } from '@agile-sofl/parser'

export type ModulePatchAction = 'add' | 'remove' | 'rename'

function normalizeModuleName(name: string): string {
  return name.startsWith('SYSTEM_') ? name.slice('SYSTEM_'.length) : name
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

export function addModule(
  source: string,
  moduleName: string,
  options?: { parentName?: string; isSystem?: boolean }
): string {
  const bare = normalizeModuleName(moduleName)
  const header = options?.isSystem
    ? `module SYSTEM_${bare};`
    : options?.parentName
      ? `module ${bare} / ${options.parentName};`
      : `module ${bare};`
  const block = `${header}\nend_module`
  const trimmed = source.trimEnd()
  const suffix = trimmed.endsWith('.') ? '' : trimmed.endsWith(';') ? '\n.' : '\n'
  return `${trimmed}${suffix}\n${block}`
}

export function removeModule(source: string, moduleName: string): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, moduleName)
  if (!mod) return source
  const span = moduleBlockSpan(source, mod)
  let next = source.slice(0, span.start) + source.slice(span.end)
  next = next.replace(/\n{3,}/g, '\n\n')
  return next.trimEnd()
}

export function renameModule(source: string, moduleName: string, newName: string): string {
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
