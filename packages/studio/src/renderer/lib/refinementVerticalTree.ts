import type { RefinementModuleRow, RefinementProcessRow, RefinementStateDto } from './refinementTypes'
import { leafStats } from './atomicityTree'

export type VerticalNodeKind = 'module' | 'composite' | 'leaf' | 'gap'

export interface RefinementVerticalNode {
  id: string
  kind: VerticalNodeKind
  label: string
  status?: 'atomic' | 'ready' | 'open'
  moduleName?: string
  processName?: string
  summary?: string
  problem: boolean
  children: RefinementVerticalNode[]
}

export interface VerticalLayoutNode {
  id: string
  kind: VerticalNodeKind
  label: string
  status?: 'atomic' | 'ready' | 'open'
  x: number
  y: number
  width: number
  height: number
  problem: boolean
  summary?: string
}

export interface VerticalLayoutEdge {
  from: string
  to: string
}

export interface VerticalTreeLayout {
  nodes: VerticalLayoutNode[]
  edges: VerticalLayoutEdge[]
  width: number
  height: number
}

export const VERTICAL_NODE_W = 168
export const VERTICAL_NODE_H = 44
const SIBLING_GAP = 28
const LEVEL_GAP = 36
const PAD = 24

function moduleLabel(mod: RefinementModuleRow): string {
  return mod.isSystem ? `SYSTEM_${mod.name}` : mod.name
}

function findModule(
  modules: RefinementModuleRow[],
  name: string | undefined
): RefinementModuleRow | undefined {
  if (!name) return undefined
  const bare = name.startsWith('SYSTEM_') ? name.slice('SYSTEM_'.length) : name
  return modules.find((m) => m.name === name || m.name === bare || `SYSTEM_${m.name}` === name)
}

function decomTargets(processes: RefinementProcessRow[]): Set<string> {
  const set = new Set<string>()
  for (const p of processes) {
    const t = p.decomTarget?.trim()
    if (!t) continue
    set.add(t)
    if (t.startsWith('SYSTEM_')) set.add(t.slice('SYSTEM_'.length))
    else set.add(`SYSTEM_${t}`)
  }
  return set
}

function processesOf(rows: RefinementProcessRow[], moduleName: string): RefinementProcessRow[] {
  return rows.filter((p) => p.moduleName === moduleName)
}

function moduleNameKeys(name: string): string[] {
  const bare = name.startsWith('SYSTEM_') ? name.slice('SYSTEM_'.length) : name
  return [name, bare, `SYSTEM_${bare}`]
}

function isDecomTarget(targets: Set<string>, name: string): boolean {
  return moduleNameKeys(name).some((key) => targets.has(key))
}

/** Modules that are not a process decomposition hang directly under the SYSTEM module. */
function modulesUnderSystem(state: RefinementStateDto, system: RefinementModuleRow): RefinementModuleRow[] {
  const targets = decomTargets(state.processes)
  return state.modules.filter((mod) => {
    if (mod.name === system.name) return false
    if (mod.isSystem) return false
    return !isDecomTarget(targets, mod.name)
  })
}

function buildModuleNode(
  state: RefinementStateDto,
  mod: RefinementModuleRow,
  seen: Set<string>,
  nestedModules: RefinementModuleRow[] = []
): RefinementVerticalNode {
  const id = `mod:${mod.name}`
  if (seen.has(mod.name)) {
    return {
      id: `${id}:cycle`,
      kind: 'gap',
      label: mod.name,
      problem: true,
      summary: 'cycle',
      children: []
    }
  }
  seen.add(mod.name)
  const children: RefinementVerticalNode[] = []

  if (!mod.isEmpty) {
    for (const proc of processesOf(state.processes, mod.name)) {
      if (proc.hasDecom) children.push(buildCompositeNode(state, proc, new Set(seen)))
      else children.push(buildLeafNode(proc))
    }
  }
  for (const child of nestedModules) {
    children.push(buildModuleNode(state, child, seen))
  }
  if (!children.length && mod.isEmpty) {
    children.push({
      id: `${id}:empty`,
      kind: 'gap',
      label: 'empty-module',
      moduleName: mod.name,
      problem: true,
      children: []
    })
  }

  const own = mod.isEmpty ? { atomic: 0, total: 0 } : leafStats(state, mod.name)
  let atomic = own.atomic
  let total = own.total
  for (const child of nestedModules) {
    const stats = leafStats(state, child.name)
    atomic += stats.atomic
    total += stats.total
  }

  return {
    id,
    kind: 'module',
    label: moduleLabel(mod),
    moduleName: mod.name,
    summary: `${atomic}/${total}`,
    problem: children.some((child) => child.problem) || (total > 0 && atomic < total),
    children
  }
}

function buildCompositeNode(state: RefinementStateDto, proc: RefinementProcessRow, seen: Set<string>): RefinementVerticalNode {
  const id = `proc:${proc.moduleName}:${proc.processName}`
  const child = findModule(state.modules, proc.decomTarget)
  const stats = child ? leafStats(state, child.name) : { atomic: 0, total: 0 }
  const children: RefinementVerticalNode[] = []
  if (child) children.push(buildModuleNode(state, child, seen))
  else if (proc.decomTarget) {
    children.push({
      id: `${id}:missing`,
      kind: 'gap',
      label: proc.decomTarget,
      moduleName: proc.decomTarget,
      problem: true,
      children: []
    })
  }
  return {
    id,
    kind: 'composite',
    label: proc.processName,
    status: 'open',
    moduleName: proc.moduleName,
    processName: proc.processName,
    summary: `${stats.atomic}/${stats.total}`,
    problem: stats.atomic < stats.total || !child,
    children
  }
}

function buildLeafNode(proc: RefinementProcessRow): RefinementVerticalNode {
  const id = `proc:${proc.moduleName}:${proc.processName}`
  return {
    id,
    kind: 'leaf',
    label: proc.processName,
    status: proc.status,
    moduleName: proc.moduleName,
    processName: proc.processName,
    summary: proc.status,
    problem: proc.status !== 'atomic',
    children: []
  }
}

/** Forest rooted at each SYSTEM module. Other modules are its children unless a process decom already owns them. */
export function buildRefinementVerticalForest(state: RefinementStateDto): RefinementVerticalNode[] {
  const systems = state.modules.filter((mod) => mod.isSystem)
  if (systems.length) {
    return systems.map((system) =>
      buildModuleNode(state, system, new Set(), modulesUnderSystem(state, system))
    )
  }
  const targets = decomTargets(state.processes)
  const roots = state.modules.filter((mod) => !isDecomTarget(targets, mod.name))
  return roots.map((mod) => buildModuleNode(state, mod, new Set()))
}

interface Piece {
  nodes: VerticalLayoutNode[]
  edges: VerticalLayoutEdge[]
  minX: number
  maxX: number
  maxY: number
}

function shiftPiece(piece: Piece, dx: number): Piece {
  if (dx === 0) return piece
  return {
    nodes: piece.nodes.map((n) => ({ ...n, x: n.x + dx })),
    edges: piece.edges,
    minX: piece.minX + dx,
    maxX: piece.maxX + dx,
    maxY: piece.maxY
  }
}

function placeNode(n: RefinementVerticalNode, depth: number): Piece {
  const y = depth * (VERTICAL_NODE_H + LEVEL_GAP)
  if (!n.children.length) {
    const node: VerticalLayoutNode = {
      id: n.id,
      kind: n.kind,
      label: n.label,
      status: n.status,
      x: 0,
      y,
      width: VERTICAL_NODE_W,
      height: VERTICAL_NODE_H,
      problem: n.problem,
      summary: n.summary
    }
    return { nodes: [node], edges: [], minX: 0, maxX: VERTICAL_NODE_W, maxY: y + VERTICAL_NODE_H }
  }

  let cursor = 0
  const childPieces: Piece[] = []
  for (const child of n.children) {
    const placed = placeNode(child, depth + 1)
    const shifted = shiftPiece(placed, cursor - placed.minX)
    childPieces.push(shifted)
    cursor = shifted.maxX + SIBLING_GAP
  }
  const kidsMax = cursor - SIBLING_GAP
  let parentX = (0 + kidsMax) / 2 - VERTICAL_NODE_W / 2
  const parent: VerticalLayoutNode = {
    id: n.id,
    kind: n.kind,
    label: n.label,
    status: n.status,
    x: parentX,
    y,
    width: VERTICAL_NODE_W,
    height: VERTICAL_NODE_H,
    problem: n.problem,
    summary: n.summary
  }
  const edges: VerticalLayoutEdge[] = n.children.map((c) => ({ from: n.id, to: c.id }))
  let nodes = [parent]
  let minX = parentX
  let maxX = parentX + VERTICAL_NODE_W
  let maxY = y + VERTICAL_NODE_H
  for (const piece of childPieces) {
    nodes = nodes.concat(piece.nodes)
    edges.push(...piece.edges)
    minX = Math.min(minX, piece.minX)
    maxX = Math.max(maxX, piece.maxX)
    maxY = Math.max(maxY, piece.maxY)
  }
  const normalized = shiftPiece({ nodes, edges, minX, maxX, maxY }, -minX)
  return normalized
}

/** Lay out one tree so sibling subtrees never share horizontal space. */
export function layoutVerticalTree(root: RefinementVerticalNode): VerticalTreeLayout {
  const piece = shiftPiece(placeNode(root, 0), PAD)
  const width = piece.maxX + PAD
  const height = piece.maxY + PAD
  return { nodes: piece.nodes, edges: piece.edges, width, height }
}

/** Layout multiple roots stacked vertically without overlap. */
export function layoutRefinementVerticalForest(forest: RefinementVerticalNode[]): VerticalTreeLayout {
  if (!forest.length) {
    return { nodes: [], edges: [], width: 320, height: 120 }
  }
  const nodes: VerticalLayoutNode[] = []
  const edges: VerticalLayoutEdge[] = []
  let offsetY = 0
  let maxWidth = 320
  for (const root of forest) {
    const part = layoutVerticalTree(root)
    const top = part.nodes.reduce((m, n) => Math.min(m, n.y), Number.POSITIVE_INFINITY)
    const dy = offsetY - top
    let bottom = offsetY
    for (const n of part.nodes) {
      const y = n.y + dy
      nodes.push({ ...n, y })
      bottom = Math.max(bottom, y + n.height)
    }
    edges.push(...part.edges)
    maxWidth = Math.max(maxWidth, part.width)
    offsetY = bottom + 48
  }
  return { nodes, edges, width: maxWidth, height: Math.max(offsetY, 120) }
}

export function buildVerticalTreeLayout(state: RefinementStateDto): VerticalTreeLayout {
  return layoutRefinementVerticalForest(buildRefinementVerticalForest(state))
}

export function verticalNodesOverlap(a: VerticalLayoutNode, b: VerticalLayoutNode): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}
