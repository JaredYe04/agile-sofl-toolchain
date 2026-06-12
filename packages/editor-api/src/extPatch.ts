import { parse, type ProgramNode } from '@agile-sofl/parser'

export type ExtVarDto = {
  access: 'rd' | 'wr'
  name: string
  type?: string
}

function normalizeModuleName(name: string): string {
  return name.startsWith('SYSTEM_') ? name.slice('SYSTEM_'.length) : name
}

function findModule(ast: ProgramNode, moduleName: string) {
  const bare = normalizeModuleName(moduleName)
  return ast.modules.find((m) => m.name === bare || m.name === moduleName)
}

function buildExtBlock(vars: ExtVarDto[]): string {
  if (!vars.length) return ''
  const lines = vars.map((v) => {
    const type = v.type?.trim()
    return `  ${v.access} ${v.name}${type ? `: ${type}` : ''}`
  })
  return `ext\n${lines.join('\n')}\n`
}

function extBlockSpan(source: string, procSpan: { start: number; end: number }): { start: number; end: number } | null {
  const slice = source.slice(procSpan.start, procSpan.end)
  const match = /\next\s*\r?\n([\s\S]*?)(?=\r?\n\s*(?:FSF|decom|comment|end_process))/i.exec(slice)
  if (!match) return null
  const extStart = procSpan.start + match.index + 1
  const extEnd = extStart + match[0].length
  return { start: extStart, end: extEnd }
}

function headerLineEnd(source: string, procSpan: { start: number }): number {
  let i = procSpan.start
  while (i < source.length && source[i] !== '\n') i++
  return i
}

export function patchExt(
  source: string,
  moduleName: string,
  processName: string,
  vars: ExtVarDto[]
): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, moduleName)
  const proc = mod?.processes.find((p) => p.name === processName)
  if (!proc?.body) return source

  const block = buildExtBlock(vars)
  const existing = extBlockSpan(source, proc.span)

  if (existing) {
    if (!block) {
      return source.slice(0, existing.start) + source.slice(existing.end)
    }
    return source.slice(0, existing.start) + block + source.slice(existing.end)
  }

  if (!block) return source
  const insertAt = headerLineEnd(source, proc.span)
  return source.slice(0, insertAt) + `\n${block}` + source.slice(insertAt)
}
