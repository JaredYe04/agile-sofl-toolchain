import type { ProgramNode, ModuleNode } from '@agile-sofl/parser'
import { textOf } from '@agile-sofl/parser'
import { toSerializableSpan, type SerializableSpan } from './span.js'

export type ModuleGraphNodeKind = 'module' | 'process' | 'function'

export interface ModuleGraphNode {
  id: string
  kind: ModuleGraphNodeKind
  name: string
  parentId?: string
  span: SerializableSpan
}

export interface ModuleGraphEdge {
  from: string
  to: string
  kind: 'parent' | 'decom'
}

export interface ModuleGraph {
  nodes: ModuleGraphNode[]
  edges: ModuleGraphEdge[]
}

export function buildModuleGraph(ast: ProgramNode): ModuleGraph {
  const nodes: ModuleGraphNode[] = []
  const edges: ModuleGraphEdge[] = []

  for (const mod of ast.modules) {
    addModuleNode(mod, nodes, edges)
    for (const proc of mod.processes) {
      const procId = `${mod.name}::process::${proc.name}`
      nodes.push({
        id: procId,
        kind: 'process',
        name: proc.name,
        parentId: mod.name,
        span: toSerializableSpan(proc.span)
      })
      if (textOf(proc.body?.decomposition)) {
        edges.push({ from: procId, to: textOf(proc.body!.decomposition)!, kind: 'decom' })
      }
    }
    for (const fn of mod.functions) {
      nodes.push({
        id: `${mod.name}::function::${fn.name}`,
        kind: 'function',
        name: fn.name,
        parentId: mod.name,
        span: toSerializableSpan(fn.span)
      })
    }
  }

  return { nodes, edges }
}

function addModuleNode(mod: ModuleNode, nodes: ModuleGraphNode[], edges: ModuleGraphEdge[]): void {
  nodes.push({
    id: mod.name,
    kind: 'module',
    name: mod.isSystem ? `SYSTEM_${mod.name}` : mod.name,
    parentId: mod.parent?.name,
    span: toSerializableSpan(mod.span)
  })
  if (mod.parent?.name) {
    edges.push({ from: mod.name, to: mod.parent.name, kind: 'parent' })
  }
}
