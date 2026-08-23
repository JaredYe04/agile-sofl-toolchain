export type HierarchyMod = {
  name: string
  displayName: string
  isSystem?: boolean
  isGui?: boolean
  parentName?: string
}

export type LaidOutNode = {
  name: string
  displayName: string
  isSystem: boolean
  isGui: boolean
  x: number
  y: number
  w: number
  children: LaidOutNode[]
}

export type HierarchyLayout = {
  nodes: LaidOutNode[]
  links: Array<{ from: LaidOutNode; to: LaidOutNode }>
  width: number
  height: number
}

export const NODE_H = 22
export const V_GAP = 30
const H_GAP = 8
const PAD = 10
const MIN_NODE_W = 44
const MAX_NODE_W = 120

type Tree = { mod: HierarchyMod; children: Tree[] }
type Measured = Tree & { nodeW: number; subtreeW: number; children: Measured[] }

export function labelOf(mod: HierarchyMod): string {
  return mod.displayName.replace(/^SYSTEM_/, '')
}

function parentMatches(child: HierarchyMod, parent: HierarchyMod): boolean {
  const display = parent.displayName.replace(/^SYSTEM_/, '')
  return child.parentName === parent.name || child.parentName === display
}

export function buildForest(mods: HierarchyMod[]): Tree[] {
  const roots = mods.filter(
    (m) => m.isSystem || !mods.some((p) => parentMatches(m, p))
  )
  const used = new Set<string>()
  function node(mod: HierarchyMod): Tree {
    used.add(mod.name)
    const kids = mods.filter((c) => !used.has(c.name) && parentMatches(c, mod))
    return { mod, children: kids.map(node) }
  }
  return roots.map(node)
}

function fanout(trees: Tree[]): number {
  let max = 1
  function walk(n: Tree): void {
    if (n.children.length > max) max = n.children.length
    n.children.forEach(walk)
  }
  trees.forEach(walk)
  return max
}

function estimateTextWidth(text: string): number {
  return Math.ceil(text.length * 6.2 + 12)
}

function measure(node: Tree, maxNodeW: number): Measured {
  const kids = node.children.map((c) => measure(c, maxNodeW))
  const nodeW = Math.min(maxNodeW, Math.max(MIN_NODE_W, estimateTextWidth(labelOf(node.mod))))
  const childSpan =
    kids.length === 0 ? 0 : kids.reduce((s, c) => s + c.subtreeW, 0) + (kids.length - 1) * H_GAP
  return {
    ...node,
    nodeW,
    subtreeW: Math.max(nodeW, childSpan),
    children: kids
  }
}

function place(node: Measured, left: number, top: number): LaidOutNode {
  const x = left + node.subtreeW / 2
  const laid: LaidOutNode = {
    name: node.mod.name,
    displayName: labelOf(node.mod),
    isSystem: Boolean(node.mod.isSystem),
    isGui: Boolean(node.mod.isGui),
    x,
    y: top,
    w: node.nodeW,
    children: []
  }
  if (node.children.length === 0) return laid
  const childSpan =
    node.children.reduce((s, c) => s + c.subtreeW, 0) + (node.children.length - 1) * H_GAP
  let cx = left + Math.max(0, (node.subtreeW - childSpan) / 2)
  for (const child of node.children) {
    laid.children.push(place(child, cx, top + NODE_H + V_GAP))
    cx += child.subtreeW + H_GAP
  }
  return laid
}

function flatten(nodes: LaidOutNode[]): LaidOutNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)])
}

function collectLinks(nodes: LaidOutNode[]): Array<{ from: LaidOutNode; to: LaidOutNode }> {
  const links: Array<{ from: LaidOutNode; to: LaidOutNode }> = []
  for (const n of nodes) {
    for (const c of n.children) links.push({ from: n, to: c })
  }
  return links
}

export function layoutHierarchyForest(mods: HierarchyMod[], viewportWidth: number): HierarchyLayout {
  const forest = buildForest(mods)
  const avail = Math.max(120, viewportWidth) - PAD * 2
  const maxNodeW = Math.min(
    MAX_NODE_W,
    Math.max(MIN_NODE_W, Math.floor((avail - (fanout(forest) - 1) * H_GAP) / Math.max(1, fanout(forest))))
  )
  const measured = forest.map((t) => measure(t, maxNodeW))
  const trees: LaidOutNode[] = []
  let y = PAD + NODE_H / 2
  let maxW = avail
  for (const tree of measured) {
    const laid = place(tree, PAD, y)
    trees.push(laid)
    const flat = flatten([laid])
    const bottom = Math.max(...flat.map((n) => n.y)) + NODE_H / 2
    const right = Math.max(...flat.map((n) => n.x + n.w / 2))
    maxW = Math.max(maxW, right + PAD)
    y = bottom + V_GAP + NODE_H / 2
  }
  const nodes = flatten(trees)
  if (nodes.length === 0) {
    return { nodes: [], links: [], width: Math.max(120, viewportWidth), height: 80 }
  }
  const height = Math.max(...nodes.map((n) => n.y)) + NODE_H / 2 + PAD
  return {
    nodes,
    links: collectLinks(nodes),
    width: Math.ceil(maxW),
    height: Math.ceil(height)
  }
}

export function elbowPath(
  from: LaidOutNode,
  to: LaidOutNode,
  nodeH = NODE_H
): string {
  const x1 = from.x
  const y1 = from.y + nodeH / 2
  const x2 = to.x
  const y2 = to.y - nodeH / 2
  const midY = (y1 + y2) / 2
  return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`
}
