import { parse, printCdfdBlock, type CdfdBlockNode, type CdfdFlowNode, type ProgramNode } from '@agile-sofl/parser'

const SPAN = { start: 0, end: 0, line: 1, column: 1 }

function findModule(ast: ProgramNode, moduleName: string) {
  const key = moduleName.startsWith('SYSTEM_') ? moduleName.slice('SYSTEM_'.length) : moduleName
  return ast.modules.find((m) => m.name === moduleName || m.name === key)
}

function cdfdOrEmpty(): CdfdBlockNode {
  return {
    type: 'cdfd',
    span: SPAN,
    ports: [],
    stores: [],
    nodes: [],
    conditions: [],
    flows: []
  }
}

/** Replace or insert the cdfd block for a module. */
export function patchCdfdBlock(source: string, moduleName: string, cdfd: CdfdBlockNode): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, moduleName)
  if (!mod) return source
  const text = printCdfdBlock(cdfd)
  if (mod.cdfd) {
    return source.slice(0, mod.cdfd.span.start) + text + source.slice(mod.cdfd.span.end)
  }
  const endKw = source.lastIndexOf('end_module', mod.span.end)
  const at = endKw >= 0 ? endKw : mod.span.end
  const prefix = at > 0 && source[at - 1] !== '\n' ? '\n' : ''
  return source.slice(0, at) + `${prefix}${text}\n` + source.slice(at)
}

export function addCdfdFlow(
  source: string,
  moduleName: string,
  flow: { from: string; to: string; guard?: string; isOthers?: boolean }
): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, moduleName)
  if (!mod) return source
  const cdfd = mod.cdfd ? { ...mod.cdfd, flows: [...mod.cdfd.flows] } : cdfdOrEmpty()
  const nextFlow: CdfdFlowNode = {
    type: 'cdfd_flow',
    span: SPAN,
    from: flow.from,
    to: flow.to,
    isOthers: flow.isOthers
  }
  cdfd.flows.push(nextFlow)
  return patchCdfdBlock(source, moduleName, cdfd)
}
