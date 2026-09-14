import type { DockLeaf, DockNode, DockPanelId, DockSplit, DockZone } from '../../shared/dockLayout'

export type { DockLeaf, DockNode, DockPanelId, DockSplit, DockZone } from '../../shared/dockLayout'

export const DOCK_PANEL_IDS: DockPanelId[] = ['informal', 'agent', 'hybrid']

export function defaultDockLayout(): DockNode {
  return {
    kind: 'split',
    direction: 'horizontal',
    ratio: 22 / (22 + 38),
    first: {
      kind: 'split',
      direction: 'vertical',
      ratio: 0.58,
      first: { kind: 'panel', panel: 'informal' },
      second: { kind: 'panel', panel: 'agent' }
    },
    second: { kind: 'panel', panel: 'hybrid' }
  }
}

export function cloneDockNode(node: DockNode): DockNode {
  if (node.kind === 'panel') return { ...node }
  return {
    ...node,
    first: cloneDockNode(node.first),
    second: cloneDockNode(node.second)
  }
}

export function collectPanels(node: DockNode, out = new Set<DockPanelId>()): Set<DockPanelId> {
  if (node.kind === 'panel') {
    out.add(node.panel)
    return out
  }
  collectPanels(node.first, out)
  collectPanels(node.second, out)
  return out
}

export function isValidDockLayout(node: DockNode): boolean {
  const found = collectPanels(node)
  return DOCK_PANEL_IDS.every((id) => found.has(id))
}

export function removePanel(
  root: DockNode,
  panel: DockPanelId
): { tree: DockNode | null; removed: boolean } {
  if (root.kind === 'panel') {
    if (root.panel === panel) return { tree: null, removed: true }
    return { tree: root, removed: false }
  }
  const left = removePanel(root.first, panel)
  if (left.removed) {
    if (left.tree === null) return { tree: root.second, removed: true }
    return { tree: { ...root, first: left.tree }, removed: true }
  }
  const right = removePanel(root.second, panel)
  if (right.removed) {
    if (right.tree === null) return { tree: root.first, removed: true }
    return { tree: { ...root, second: right.tree }, removed: true }
  }
  return { tree: root, removed: false }
}

export function replacePanel(
  root: DockNode,
  target: DockPanelId,
  replacer: (leaf: DockLeaf) => DockNode
): DockNode | null {
  if (root.kind === 'panel') {
    return root.panel === target ? replacer(root) : root
  }
  const first = replacePanel(root.first, target, replacer)
  const second = replacePanel(root.second, target, replacer)
  if (first === null || second === null) return null
  return { ...root, first, second }
}

export function dockPanel(
  root: DockNode,
  drag: DockPanelId,
  target: DockPanelId,
  zone: DockZone
): DockNode | null {
  if (drag === target) return root
  const { tree: without } = removePanel(cloneDockNode(root), drag)
  if (!without) return null
  const dragLeaf: DockLeaf = { kind: 'panel', panel: drag }

  const wrap = (targetLeaf: DockLeaf): DockNode => {
    if (zone === 'left') {
      return { kind: 'split', direction: 'horizontal', ratio: 0.5, first: dragLeaf, second: targetLeaf }
    }
    if (zone === 'right') {
      return { kind: 'split', direction: 'horizontal', ratio: 0.5, first: targetLeaf, second: dragLeaf }
    }
    if (zone === 'top') {
      return { kind: 'split', direction: 'vertical', ratio: 0.5, first: dragLeaf, second: targetLeaf }
    }
    return { kind: 'split', direction: 'vertical', ratio: 0.5, first: targetLeaf, second: dragLeaf }
  }

  const next = replacePanel(without, target, wrap)
  return next && isValidDockLayout(next) ? next : root
}

export function updateSplitRatioAtPath(root: DockNode, path: readonly number[], ratio: number): DockNode {
  if (path.length === 0) {
    if (root.kind === 'split') return { ...root, ratio }
    return root
  }
  if (root.kind !== 'split') return root
  const [head, ...rest] = path
  if (head === 0) return { ...root, first: updateSplitRatioAtPath(root.first, rest, ratio) }
  return { ...root, second: updateSplitRatioAtPath(root.second, rest, ratio) }
}

export function dockZoneFromPoint(rect: DOMRect, clientX: number, clientY: number): DockZone | null {
  const w = rect.width
  const h = rect.height
  if (w <= 0 || h <= 0) return null
  const x = (clientX - rect.left) / w
  const y = (clientY - rect.top) / h
  const edge = 0.28
  if (x < edge) return 'left'
  if (x > 1 - edge) return 'right'
  if (y < edge) return 'top'
  if (y > 1 - edge) return 'bottom'
  return null
}

export function parseDockLayout(raw: unknown): DockNode {
  const parsed = parseNode(raw)
  if (parsed && isValidDockLayout(parsed)) return parsed
  return defaultDockLayout()
}

function parseNode(raw: unknown): DockNode | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.kind === 'panel' && DOCK_PANEL_IDS.includes(o.panel as DockPanelId)) {
    return { kind: 'panel', panel: o.panel as DockPanelId }
  }
  if (o.kind === 'split' && (o.direction === 'horizontal' || o.direction === 'vertical')) {
    const ratio = typeof o.ratio === 'number' ? o.ratio : 0.5
    const first = parseNode(o.first)
    const second = parseNode(o.second)
    if (!first || !second) return null
    return {
      kind: 'split',
      direction: o.direction,
      ratio: Math.min(0.85, Math.max(0.15, ratio)),
      first,
      second
    }
  }
  return null
}

export function serializeDockLayout(node: DockNode): DockNode {
  return cloneDockNode(node)
}
