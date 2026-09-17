import type { SpecMap, SpecMapEdge, SpecMapLane, SpecMapNode } from './types.js'

export type SpecMapBBox = { minX: number; minY: number; maxX: number; maxY: number }

export interface SpecMapLayoutNode extends SpecMapNode {
  x: number
  y: number
  width: number
  height: number
}

export interface SpecMapLayoutEdge extends SpecMapEdge {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface SpecMapLayoutLane extends SpecMapLane {
  x: number
  y: number
  width: number
  height: number
}

export interface SpecMapLayout {
  nodes: SpecMapLayoutNode[]
  edges: SpecMapLayoutEdge[]
  lanes: SpecMapLayoutLane[]
  lifelines: Array<{ x: number; y1: number; y2: number }>
  bbox: SpecMapBBox
}

const NODE_H = 36
const PAD = 24
const GAP_X = 40
const GAP_Y = 24
const COL_W = 168

function measureWidth(label: string): number {
  return Math.max(88, Math.min(176, 18 + [...label].length * 7.2))
}

function bboxOf(nodes: SpecMapLayoutNode[], extraY = 0): SpecMapBBox {
  if (!nodes.length) return { minX: 0, minY: 0, maxX: 240, maxY: 140 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = extraY
  for (const n of nodes) {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + n.width)
    maxY = Math.max(maxY, n.y + n.height)
  }
  return {
    minX: minX - 12,
    minY: minY - 12,
    maxX: maxX + 12,
    maxY: maxY + 12
  }
}

function connect(nodes: SpecMapLayoutNode[], edges: SpecMapEdge[]): SpecMapLayoutEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out: SpecMapLayoutEdge[] = []
  for (const edge of edges) {
    const a = byId.get(edge.from)
    const b = byId.get(edge.to)
    if (!a || !b) continue
    out.push({
      ...edge,
      x1: a.x + a.width / 2,
      y1: a.y + a.height / 2,
      x2: b.x + b.width / 2,
      y2: b.y + b.height / 2
    })
  }
  return out
}

function assignLayers(map: SpecMap): Map<string, number> {
  const indeg = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const n of map.nodes) {
    indeg.set(n.id, 0)
    adj.set(n.id, [])
  }
  for (const e of map.edges) {
    if (!indeg.has(e.from) || !indeg.has(e.to)) continue
    adj.get(e.from)!.push(e.to)
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1)
  }
  const layer = new Map<string, number>()
  const queue = map.nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id)
  for (const id of queue) layer.set(id, 0)
  while (queue.length) {
    const id = queue.shift()!
    const current = layer.get(id) ?? 0
    for (const to of adj.get(id) ?? []) {
      layer.set(to, Math.max(layer.get(to) ?? 0, current + 1))
      const next = (indeg.get(to) ?? 1) - 1
      indeg.set(to, next)
      if (next <= 0) queue.push(to)
    }
  }
  for (const n of map.nodes) {
    if (!layer.has(n.id)) layer.set(n.id, 0)
  }
  return layer
}

function layoutLayered(map: SpecMap): SpecMapLayout {
  const layers = assignLayers(map)
  const byLayer = new Map<number, SpecMapNode[]>()
  for (const n of map.nodes) {
    const l = layers.get(n.id) ?? 0
    byLayer.set(l, [...(byLayer.get(l) ?? []), n])
  }
  const laid: SpecMapLayoutNode[] = []
  const maxLayer = Math.max(0, ...byLayer.keys())
  for (let l = 0; l <= maxLayer; l++) {
    const col = byLayer.get(l) ?? []
    col.forEach((n, i) => {
      const w = measureWidth(n.label)
      laid.push({
        ...n,
        x: PAD + l * (COL_W + GAP_X),
        y: PAD + i * (NODE_H + GAP_Y),
        width: w,
        height: NODE_H
      })
    })
  }
  return { nodes: laid, edges: connect(laid, map.edges), lanes: [], lifelines: [], bbox: bboxOf(laid) }
}

function layoutDataflow(map: SpecMap): SpecMapLayout {
  const colOf = (n: SpecMapNode): number => {
    if (n.kind === 'database' || n.kind === 'store') return 0
    if (n.kind === 'process' || n.kind === 'active') return 1
    return 2
  }
  const cols = new Map<number, SpecMapNode[]>()
  for (const n of map.nodes) {
    const c = colOf(n)
    cols.set(c, [...(cols.get(c) ?? []), n])
  }
  const laid: SpecMapLayoutNode[] = []
  for (const [c, list] of [...cols.entries()].sort((a, b) => a[0] - b[0])) {
    list.forEach((n, i) => {
      const w = measureWidth(n.label)
      laid.push({
        ...n,
        x: PAD + c * (COL_W + GAP_X),
        y: PAD + i * (NODE_H + GAP_Y),
        width: w,
        height: NODE_H
      })
    })
  }
  return { nodes: laid, edges: connect(laid, map.edges), lanes: [], lifelines: [], bbox: bboxOf(laid) }
}

function layoutSwimlane(map: SpecMap): SpecMapLayout {
  const lanes = map.lanes ?? []
  const layers = assignLayers(map)
  const LANE_H = 112
  const laidLanes: SpecMapLayoutLane[] = []
  const laneY = new Map<string, number>()
  let y = PAD
  const maxLayer = Math.max(0, ...[...layers.values()])
  const width = PAD + (maxLayer + 1) * (COL_W + GAP_X)
  for (const lane of lanes) {
    laneY.set(lane.id, y)
    laidLanes.push({ ...lane, x: PAD, y, width, height: LANE_H })
    y += LANE_H + 12
  }
  const used = new Map<string, number>()
  const laid: SpecMapLayoutNode[] = []
  for (const n of map.nodes) {
    const layer = layers.get(n.id) ?? 0
    const ly = n.laneId ? (laneY.get(n.laneId) ?? PAD) : PAD
    const key = `${n.laneId ?? '_'}@${layer}`
    const idx = used.get(key) ?? 0
    used.set(key, idx + 1)
    const w = measureWidth(n.label)
    laid.push({
      ...n,
      x: PAD + 20 + layer * (COL_W + 16),
      y: ly + 28 + idx * (NODE_H + 8),
      width: w,
      height: NODE_H
    })
  }
  return { nodes: laid, edges: connect(laid, map.edges), lanes: laidLanes, lifelines: [], bbox: bboxOf(laid) }
}

function layoutSequence(map: SpecMap): SpecMapLayout {
  const participants = [...map.nodes].sort((a, b) => (a.column ?? 0) - (b.column ?? 0))
  const laid: SpecMapLayoutNode[] = []
  let x = PAD
  for (const n of participants) {
    const w = measureWidth(n.label)
    laid.push({ ...n, x, y: PAD, width: w, height: NODE_H })
    x += w + GAP_X
  }
  const byId = new Map(laid.map((n) => [n.id, n]))
  const laidEdges: SpecMapLayoutEdge[] = []
  let y = PAD + NODE_H + 36
  for (const edge of map.edges) {
    const a = byId.get(edge.from)
    const b = byId.get(edge.to)
    if (!a || !b) continue
    laidEdges.push({
      ...edge,
      x1: a.x + a.width / 2,
      y1: y,
      x2: b.x + b.width / 2,
      y2: y
    })
    y += 32
  }
  const y2 = Math.max(y + 8, PAD + 160)
  const lifelines = laid.map((n) => ({
    x: n.x + n.width / 2,
    y1: n.y + n.height,
    y2
  }))
  return { nodes: laid, edges: laidEdges, lanes: [], lifelines, bbox: bboxOf(laid, y2) }
}

export function layoutSpecMap(map: SpecMap): SpecMapLayout {
  if (!map.nodes.length) {
    return {
      nodes: [],
      edges: [],
      lanes: [],
      lifelines: [],
      bbox: { minX: 0, minY: 0, maxX: 240, maxY: 140 }
    }
  }
  if (map.type === 'sequence') return layoutSequence(map)
  if (map.type === 'dataflow') return layoutDataflow(map)
  if (map.type === 'workflow' && (map.lanes?.length ?? 0) > 0) return layoutSwimlane(map)
  return layoutLayered(map)
}
