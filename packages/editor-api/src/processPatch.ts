import { parse, type ModuleNode, type ProgramNode } from '@agile-sofl/parser'

export type ProcessPatchAction = 'add' | 'remove' | 'rename'
export type FunctionPatchAction = 'add' | 'remove'

function normalizeModuleName(name: string): string {
  return name.startsWith('SYSTEM_') ? name.slice('SYSTEM_'.length) : name
}

function findModule(ast: ProgramNode, moduleName: string): ModuleNode | undefined {
  const bare = normalizeModuleName(moduleName)
  return ast.modules.find((m) => m.name === bare || m.name === moduleName)
}

function moduleBodyInsertPoint(source: string, mod: ModuleNode): number {
  const endModule = source.lastIndexOf('end_module', mod.span.end)
  return endModule >= 0 ? endModule : mod.span.end
}

function removeBlockLine(source: string, span: { start: number; end: number }): string {
  let lineStart = span.start
  while (lineStart > 0 && source[lineStart - 1] !== '\n') {
    lineStart -= 1
  }
  let lineEnd = span.end
  while (lineEnd < source.length && source[lineEnd] !== '\n') {
    lineEnd += 1
  }
  if (source[lineEnd] === '\n') lineEnd += 1
  return source.slice(0, lineStart) + source.slice(lineEnd)
}

export function addProcess(
  source: string,
  moduleName: string,
  processName: string,
  template?: string
): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, moduleName)
  if (!mod) return source
  const block =
    template ??
    `process ${processName} (x: nat) ok: nat\nFSF :\nx > 0 && ok = 1 ||\nothers && ok = 0\nend_process`
  const at = moduleBodyInsertPoint(source, mod)
  return source.slice(0, at) + `\n${block}\n` + source.slice(at)
}

export function removeProcess(source: string, moduleName: string, processName: string): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, moduleName)
  if (!mod) return source
  const proc = mod.processes.find((p) => p.name === processName)
  if (!proc) return source
  return removeBlockLine(source, proc.span)
}

export function renameProcess(
  source: string,
  moduleName: string,
  oldName: string,
  newName: string
): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, moduleName)
  const proc = mod?.processes.find((p) => p.name === oldName)
  if (!proc?.nameSpan) return source
  return source.slice(0, proc.nameSpan.start) + newName + source.slice(proc.nameSpan.end)
}

export function addFunction(
  source: string,
  moduleName: string,
  functionName: string,
  template?: string
): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, moduleName)
  if (!mod) return source
  const block =
    template ??
    `function ${functionName}(x: nat): nat\n== x + 1\nend_function`
  const at = moduleBodyInsertPoint(source, mod)
  return source.slice(0, at) + `\n${block}\n` + source.slice(at)
}

export function removeFunction(source: string, moduleName: string, functionName: string): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, moduleName)
  if (!mod) return source
  const fn = mod.functions.find((f) => f.name === functionName)
  if (!fn) return source
  return removeBlockLine(source, fn.span)
}

export function patchProcess(
  source: string,
  payload: {
    moduleName: string
    kind: 'process' | 'function'
    action: ProcessPatchAction | FunctionPatchAction
    name: string
    newName?: string
    template?: string
  }
): string {
  const { moduleName, kind, action, name, newName, template } = payload
  if (kind === 'process') {
    if (action === 'add') return addProcess(source, moduleName, name, template)
    if (action === 'remove') return removeProcess(source, moduleName, name)
    if (action === 'rename' && newName) return renameProcess(source, moduleName, name, newName)
  }
  if (kind === 'function') {
    if (action === 'add') return addFunction(source, moduleName, name, template)
    if (action === 'remove') return removeFunction(source, moduleName, name)
  }
  return source
}
