import type { CdfdGraph, CdfdGraphNode } from './cdfdGraph.js'

export interface CdfdLayoutNode {
  id: string
  x: number
  y: number
  width: number
  height: number
  kind: CdfdGraphNode['kind']
  name: string
  composite: boolean
  decomTarget?: string
}

export interface CdfdLayoutEdge {
  id: string
  from: string
  to: string
  points: Array<{ x: number; y: number }>
  guard?: string
  isOthers?: boolean
}

export interface CdfdLayout {
  nodes: CdfdLayoutNode[]
  edges: CdfdLayoutEdge[]
  bbox: { minX: number; minY: number; maxX: number; maxY: number }
}

const W: Record<CdfdGraphNode['kind'], number> = {
  'port-in': 8,
  'port-out': 8,
  process: 156,
  store: 168,
  cond: 72
}
const H: Record<CdfdGraphNode['kind'], number> = {
  'port-in': 8,
  'port-out': 8,
  process: 58,
  store: 36,
  cond: 56
}

/** Automatic layered layout. Source stores no coordinates. */
export function layoutCdfdGraph(graph: CdfdGraph): CdfdLayout {
  if (graph.empty || graph.nodes.length === 0) {
    return { nodes: [], edges: [], bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0 } }
  }
  const idToNode = new Map(graph.nodes.map((n) => [n.id, n]))
  const incoming = new Map<string, number>()
  for (const n of graph.nodes) incoming.set(n.id, 0)
  for (const e of graph.edges) incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1)

  const layerOf = new Map<string, number>()
  const queue = graph.nodes.filter((n) => n.kind === 'port-in' || (incoming.get(n.id) ?? 0) === 0)
  for (const n of queue) layerOf.set(n.id, n.kind === 'port-out' ? 99 : 0)
  const remaining = [...graph.nodes]
  let guard = 0
  while (remaining.length && guard++ < graph.nodes.length * 4) {
    const n = remaining.shift()!
    if (layerOf.has(n.id)) continue
    const preds = graph.edges.filter((e) => e.to === n.id).map((e) => layerOf.get(e.from))
    if (preds.length && preds.every((p) => p != null)) {
      layerOf.set(n.id, Math.max(...(preds as number[])) + 1)
    } else if (n.kind === 'port-out') {
      remaining.push(n)
    } else {
      remaining.push(n)
      if (guard > graph.nodes.length * 2) layerOf.set(n.id, 1)
    }
  }
  let maxLayer = 1
  for (const v of layerOf.values()) if (v < 90) maxLayer = Math.max(maxLayer, v)
  for (const n of graph.nodes) {
    if (n.kind === 'port-out') layerOf.set(n.id, maxLayer + 1)
    if (!layerOf.has(n.id)) layerOf.set(n.id, 1)
  }

  const byLayer = new Map<number, CdfdGraphNode[]>()
  for (const n of graph.nodes) {
    const layer = layerOf.get(n.id) ?? 1
    const list = byLayer.get(layer) ?? []
    list.push(n)
    byLayer.set(layer, list)
  }
  const layers = [...byLayer.keys()].sort((a, b) => a - b)
  const nodes: CdfdLayoutNode[] = []
  const colGap = 180
  const rowGap = 28
  layers.forEach((layer, col) => {
    const items = byLayer.get(layer) ?? []
    items.forEach((n, row) => {
      const width = W[n.kind]
      const height = H[n.kind]
      nodes.push({
        id: n.id,
        x: 24 + col * colGap,
        y: 24 + row * (Math.max(height, 48) + rowGap),
        width,
        height,
        kind: n.kind,
        name: n.name,
        composite: n.composite,
        decomTarget: n.decomTarget
      })
    })
  })

  const pos = new Map(nodes.map((n) => [n.id, n]))
  const edges: CdfdLayoutEdge[] = graph.edges.map((e) => {
    const a = pos.get(e.from)
    const b = pos.get(e.to)
    const x1 = a ? a.x + a.width : 0
    const y1 = a ? a.y + a.height / 2 : 0
    const x2 = b ? b.x : 0
    const y2 = b ? b.y + b.height / 2 : 0
    return {
      id: e.id,
      from: e.from,
      to: e.to,
      points: [
        { x: x1, y: y1 },
        { x: x2, y: y2 }
      ],
      guard: e.guard,
      isOthers: e.isOthers
    }
  })

  let minX = 0
  let minY = 0
  let maxX = 400
  let maxY = 240
  for (const n of nodes) {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + n.width)
    maxY = Math.max(maxY, n.y + n.height)
  }
  void idToNode
  return { nodes, edges, bbox: { minX, minY, maxX: maxX + 24, maxY: maxY + 24 } }
}
