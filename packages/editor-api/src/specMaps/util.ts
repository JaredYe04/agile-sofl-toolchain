import {
  PRIMARY_NODE_LIMIT,
  type InformalMapNode,
  type SpecMap,
  type SpecMapEdge,
  type SpecMapEmptyReason,
  type SpecMapKind,
  type SpecMapNode
} from './types.js'

export function emptySpecMap(type: SpecMapKind, reason: SpecMapEmptyReason): SpecMap {
  return {
    type,
    title: type,
    nodes: [],
    edges: [],
    emptyReason: reason
  }
}

export function mapId(...parts: string[]): string {
  return parts
    .map((part) =>
      String(part)
        .trim()
        .replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'n'
    )
    .join('__')
}

export function childNodes(node: InformalMapNode): InformalMapNode[] {
  return Array.isArray(node.children) ? node.children.filter((c) => typeof c === 'object' && c) : []
}

export function walkInformal(
  nodes: InformalMapNode[],
  visit: (node: InformalMapNode, depth: number, parent?: InformalMapNode) => void,
  depth = 0,
  parent?: InformalMapNode
): void {
  for (const node of nodes) {
    visit(node, depth, parent)
    walkInformal(childNodes(node), visit, depth + 1, node)
  }
}

export function sectionChildren(input: { sections: Array<{ type: string; children: InformalMapNode[] }> }, type: string): InformalMapNode[] {
  return input.sections.filter((s) => s.type === type).flatMap((s) => s.children)
}

export function splitNames(names: string | undefined): string[] {
  return (names ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
}

export function pushUniqueNode(nodes: SpecMapNode[], node: SpecMapNode): void {
  if (!nodes.some((n) => n.id === node.id)) nodes.push(node)
}

export function pushUniqueEdge(edges: SpecMapEdge[], edge: SpecMapEdge): void {
  if (edges.some((e) => e.from === edge.from && e.to === edge.to && (e.label ?? '') === (edge.label ?? ''))) {
    return
  }
  edges.push(edge)
}

export function capSpecMap(map: SpecMap, limit = PRIMARY_NODE_LIMIT): SpecMap {
  if (map.nodes.length <= limit) return map
  const connected = new Set<string>()
  for (const edge of map.edges) {
    connected.add(edge.from)
    connected.add(edge.to)
  }
  const ranked = [
    ...map.nodes.filter((n) => connected.has(n.id)),
    ...map.nodes.filter((n) => !connected.has(n.id))
  ]
  const kept = ranked.slice(0, limit)
  const keptIds = new Set(kept.map((n) => n.id))
  return {
    ...map,
    nodes: kept,
    edges: map.edges.filter((e) => keptIds.has(e.from) && keptIds.has(e.to)),
    lanes: map.lanes?.filter((lane) => kept.some((n) => n.laneId === lane.id)),
    truncatedCount: map.nodes.length - kept.length
  }
}

export function isGuiModuleName(name: string, hasGuiBlock?: boolean): boolean {
  return Boolean(hasGuiBlock) || name.startsWith('GUI_') || name === 'GUI'
}
