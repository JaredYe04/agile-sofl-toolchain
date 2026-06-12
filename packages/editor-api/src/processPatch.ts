import { parse, type ModuleNode, type ProgramNode } from '@agile-sofl/parser'
import type { FsfScenarioDto } from './fsfModel.js'

function buildFsfBody(scenarios: FsfScenarioDto[], others?: string): string {
  const lines = scenarios.map((s) => `${s.test.trim()} && ${s.def.trim()}`)
  if (others?.trim()) lines.push(`others && ${others.trim()}`)
  return lines.map((line, i) => (i < lines.length - 1 ? `${line} ||` : line)).join('\n')
}

export type ProcessPatchAction = 'add' | 'remove' | 'rename'
export type FunctionPatchAction = 'add' | 'remove' | 'rename'

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

export function renameFunction(
  source: string,
  moduleName: string,
  oldName: string,
  newName: string
): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, moduleName)
  const fn = mod?.functions.find((f) => f.name === oldName)
  if (!fn?.nameSpan) return source
  return source.slice(0, fn.nameSpan.start) + newName + source.slice(fn.nameSpan.end)
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
    if (action === 'rename' && newName) return renameFunction(source, moduleName, name, newName)
  }
  return source
}

export function patchProcessInit(
  source: string,
  moduleName: string,
  processName: string,
  isInit: boolean,
  fallbackName = 'P'
): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, moduleName)
  const proc = mod?.processes.find((p) => p.name === processName)
  if (!proc?.nameSpan || proc.alias) return source
  const newName = isInit ? 'Init' : proc.isInit ? fallbackName : proc.name
  if ((proc.isInit && isInit) || (!proc.isInit && !isInit)) return source
  return source.slice(0, proc.nameSpan.start) + newName + source.slice(proc.nameSpan.end)
}

export function patchAlias(
  source: string,
  moduleName: string,
  processName: string,
  aliasTarget: string
): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, moduleName)
  const proc = mod?.processes.find((p) => p.name === processName)
  if (!proc) return source
  const target = aliasTarget.trim()
  const block = `process ${proc.name} equal ${target}\nend_process`
  return source.slice(0, proc.span.start) + block + source.slice(proc.span.end)
}

export function patchFunction(
  source: string,
  payload: {
    moduleName: string
    name: string
    body?: string
    fsf?: { scenarios: FsfScenarioDto[]; others?: string }
  }
): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, payload.moduleName)
  const fn = mod?.functions.find((f) => f.name === payload.name)
  if (!fn) return source

  let block = source.slice(fn.span.start, fn.span.end)

  if (payload.fsf) {
    const fsfText = buildFsfBody(payload.fsf.scenarios, payload.fsf.others)
    const indented = fsfText
      .split('\n')
      .map((l) => `    ${l}`)
      .join('\n')
    if (/FSF\s*:/i.test(block)) {
      block = block.replace(/FSF\s*:[\s\S]*?(?=\n\s*==|\n\s*end_function)/i, `FSF :\n${indented}`)
    } else {
      block = block.replace(/(function[^\n]+\n)/, `$1    FSF :\n${indented}\n`)
    }
  }

  if (payload.body !== undefined) {
    const bodyLine = `    == ${payload.body.trim()}`
    if (/==/.test(block)) {
      block = block.replace(/\n\s*==[\s\S]*?(?=\n\s*end_function)/, `\n${bodyLine}`)
    } else {
      block = block.replace(/\n(\s*end_function)/, `\n${bodyLine}\n$1`)
    }
  }

  return source.slice(0, fn.span.start) + block + source.slice(fn.span.end)
}
