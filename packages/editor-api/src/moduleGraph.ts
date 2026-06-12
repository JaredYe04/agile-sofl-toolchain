import type { ProgramNode, ModuleNode } from '@agile-sofl/parser'
import { textOf } from '@agile-sofl/parser'
import { toSerializableSpan, type SerializableSpan } from './span.js'

export type ModuleGraphNodeKind = 'module' | 'process' | 'function'

export type ModuleGraphNodeRole = 'system' | 'submodule' | 'process' | 'function'

export interface ModuleGraphNode {
  id: string
  kind: ModuleGraphNodeKind
  name: string
  parentId?: string
  moduleRole?: ModuleGraphNodeRole
  span: SerializableSpan
}

export interface ModuleGraphEdge {
  from: string
  to: string
  kind: 'parent' | 'decom'
  /** false when decom target name does not match any process/function node */
  resolved?: boolean
}

export interface ModuleGraph {
  nodes: ModuleGraphNode[]
  edges: ModuleGraphEdge[]
}

/** Resolve decom target string to a graph node id (process or function by name). */
export function resolveDecomTargetId(
  targetName: string,
  nodes: ModuleGraphNode[]
): string | undefined {
  const trimmed = targetName.trim()
  const proc = nodes.find((n) => n.kind === 'process' && n.name === trimmed)
  if (proc) return proc.id
  const fn = nodes.find((n) => n.kind === 'function' && n.name === trimmed)
  if (fn) return fn.id
  return undefined
}

export function buildModuleGraph(ast: ProgramNode): ModuleGraph {
  const nodes: ModuleGraphNode[] = []
  const edges: ModuleGraphEdge[] = []
  const pendingDecom: Array<{ from: string; targetName: string }> = []

  for (const mod of ast.modules) {
    addModuleNode(mod, nodes, edges)
    for (const proc of mod.processes) {
      const procId = `${mod.name}::process::${proc.name}`
      nodes.push({
        id: procId,
        kind: 'process',
        name: proc.name,
        parentId: mod.name,
        moduleRole: 'process',
        span: toSerializableSpan(proc.span)
      })
      const decomText = textOf(proc.body?.decomposition)
      if (decomText) pendingDecom.push({ from: procId, targetName: decomText })
    }
    for (const fn of mod.functions) {
      nodes.push({
        id: `${mod.name}::function::${fn.name}`,
        kind: 'function',
        name: fn.name,
        parentId: mod.name,
        moduleRole: 'function',
        span: toSerializableSpan(fn.span)
      })
    }
  }

  for (const { from, targetName } of pendingDecom) {
    const targetId = resolveDecomTargetId(targetName, nodes)
    if (targetId) edges.push({ from, to: targetId, kind: 'decom', resolved: true })
  }

  return { nodes, edges }
}

function addModuleNode(mod: ModuleNode, nodes: ModuleGraphNode[], edges: ModuleGraphEdge[]): void {
  nodes.push({
    id: mod.name,
    kind: 'module',
    name: mod.isSystem ? `SYSTEM_${mod.name}` : mod.name,
    parentId: mod.parent?.name,
    moduleRole: mod.isSystem ? 'system' : 'submodule',
    span: toSerializableSpan(mod.span)
  })
  if (mod.parent?.name) {
    edges.push({ from: mod.name, to: mod.parent.name, kind: 'parent', resolved: true })
  }
}

/** Edges to draw on the graph (excludes layout-only parent; only resolved decom). */
export function drawableGraphEdges(graph: ModuleGraph): ModuleGraphEdge[] {
  return graph.edges.filter((e) => e.kind === 'decom' && e.resolved !== false)
}
