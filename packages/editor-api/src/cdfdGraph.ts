import type { CdfdBlockNode, ModuleNode, ProgramNode } from '@agile-sofl/parser'
import { printPredicate, textOf } from '@agile-sofl/parser'
import { toSerializableSpan, type SerializableSpan } from './span.js'

export type CdfdNodeKind = 'process' | 'store' | 'port-in' | 'port-out' | 'cond'

export interface CdfdGraphNode {
  id: string
  kind: CdfdNodeKind
  name: string
  decomTarget?: string
  composite: boolean
  span: SerializableSpan
}

export interface CdfdGraphEdge {
  id: string
  from: string
  to: string
  guard?: string
  isOthers?: boolean
}

export interface CdfdGraph {
  moduleName: string
  nodes: CdfdGraphNode[]
  edges: CdfdGraphEdge[]
  empty: boolean
}

function nodeId(moduleName: string, kind: string, name: string): string {
  return `${moduleName}::${kind}::${name}`
}

export function buildCdfdGraph(mod: ModuleNode): CdfdGraph {
  const cdfd: CdfdBlockNode | undefined = mod.cdfd
  if (!cdfd) {
    return { moduleName: mod.name, nodes: [], edges: [], empty: true }
  }
  const decomByProcess = new Map<string, string>()
  for (const proc of mod.processes) {
    const decom = textOf(proc.body?.decomposition)?.trim()
    if (decom) decomByProcess.set(proc.name, decom)
  }
  const nodes: CdfdGraphNode[] = []
  for (const port of cdfd.ports) {
    nodes.push({
      id: nodeId(mod.name, port.direction === 'in' ? 'port-in' : 'port-out', port.name),
      kind: port.direction === 'in' ? 'port-in' : 'port-out',
      name: port.name,
      composite: false,
      span: toSerializableSpan(port.span)
    })
  }
  for (const store of cdfd.stores) {
    nodes.push({
      id: nodeId(mod.name, 'store', store.name),
      kind: 'store',
      name: store.name,
      composite: false,
      span: toSerializableSpan(store.span)
    })
  }
  for (const n of cdfd.nodes) {
    const decom = decomByProcess.get(n.name)
    nodes.push({
      id: nodeId(mod.name, 'process', n.name),
      kind: 'process',
      name: n.name,
      decomTarget: decom,
      composite: Boolean(decom),
      span: toSerializableSpan(n.span)
    })
  }
  for (const cond of cdfd.conditions) {
    nodes.push({
      id: nodeId(mod.name, 'cond', cond.name),
      kind: 'cond',
      name: cond.name,
      composite: false,
      span: toSerializableSpan(cond.span)
    })
  }

  const idByName = new Map<string, string>()
  for (const n of nodes) idByName.set(`${n.kind}:${n.name}`, n.id)
  const lookup = (name: string): string | undefined => {
    for (const kind of ['process', 'store', 'port-in', 'port-out', 'cond'] as const) {
      const id = idByName.get(`${kind}:${name}`)
      if (id) return id
    }
    return nodes.find((n) => n.name === name)?.id
  }

  const edges: CdfdGraphEdge[] = cdfd.flows.map((flow, i) => ({
    id: `${mod.name}::flow::${i}`,
    from: lookup(flow.from) ?? flow.from,
    to: lookup(flow.to) ?? flow.to,
    guard: flow.isOthers ? 'others' : flow.guard ? printPredicate(flow.guard) : undefined,
    isOthers: flow.isOthers
  }))

  return { moduleName: mod.name, nodes, edges, empty: nodes.length === 0 }
}

export function buildAllCdfdGraphs(ast: ProgramNode): CdfdGraph[] {
  return ast.modules.map(buildCdfdGraph)
}
