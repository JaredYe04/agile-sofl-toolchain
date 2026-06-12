import type { ModuleGraph, ModuleGraphEdge, ModuleGraphNode } from './moduleGraph.js'

/** Parser-free: edges to draw (resolved decom only). */
function drawableGraphEdges(graph: ModuleGraph): ModuleGraphEdge[] {
  return graph.edges.filter((e) => e.kind === 'decom' && e.resolved !== false)
}

const HEADER_H = 36
const SECTION_TITLE_H = 22
const CHIP_H = 26
const PAD = 12
const MIN_W = 200
const CHAR_W = 7
const GRID_GAP = 8
const MIN_CELL_W = 96
const COMPACT_CHIP_H = 28
const MODULE_GAP_Y = 12
const LAYOUT_ORIGIN_Y = 16
const MAX_FLEX_COLS = 4

export type CompoundRow = {
  nodeId: string
  kind: 'process' | 'function' | 'submodule'
  label: string
  moduleName: string
  processName?: string
  functionName?: string
  hidden?: boolean
  compact?: boolean
  hint?: string
}

export type CompoundSection = {
  key: 'submodules' | 'processes' | 'functions'
  titleKey: string
  rows: CompoundRow[]
  y: number
  height: number
  cols?: number
}

export type CompoundModule = {
  moduleId: string
  name: string
  moduleRole?: ModuleGraphNode['moduleRole']
  x: number
  y: number
  width: number
  height: number
  depth: number
  compact?: boolean
  sections: CompoundSection[]
  rowByNodeId: Record<string, { x: number; y: number; w: number; h: number }>
}

export type DrawableGraphEdge = ModuleGraphEdge & {
  x1: number
  y1: number
  x2: number
  y2: number
}

export type ModuleGraphLayoutOrientation = 'portrait' | 'landscape'

export type ModuleGraphModuleSize = {
  width: number
  height?: number
}

export type ProcessNodeMeta = {
  isInit?: boolean
  isAlias?: boolean
  aliasTarget?: string
  hasExt?: boolean
}

export type ModuleGraphLayoutOptions = {
  searchQuery?: string
  tidy?: boolean
  /** Default portrait: tall modules with a single column of chips. */
  orientation?: ModuleGraphLayoutOrientation
  /** User-resized root module dimensions keyed by module id. */
  moduleSizes?: Record<string, ModuleGraphModuleSize>
  /** Optional per-process metadata for graph chip labels (ext, alias). */
  processMeta?: Record<string, ProcessNodeMeta>
}

export type ModuleGraphLayout = {
  compounds: CompoundModule[]
  edges: DrawableGraphEdge[]
  bbox: { minX: number; minY: number; maxX: number; maxY: number }
}

type GridItem = { nodeId: string; w: number; h: number }
type MeasureBounds = { maxW?: number; maxH?: number }
type MeasuredModule = {
  width: number
  height: number
  sections: CompoundSection[]
  compact: boolean
}

function textWidth(label: string): number {
  return Math.min(280, Math.max(MIN_CELL_W, label.length * CHAR_W + PAD))
}

function matchesQuery(label: string, q: string): boolean {
  return !q || label.toLowerCase().includes(q)
}

export function decorateProcessLabel(name: string, meta?: ProcessNodeMeta): string {
  if (meta?.isInit) return 'Init'
  if (meta?.isAlias && meta.aliasTarget) return `${name} =${meta.aliasTarget}`
  return name
}

function sortRows(rows: CompoundRow[], tidy: boolean): CompoundRow[] {
  if (!tidy) return rows
  return [...rows].sort((a, b) => a.label.localeCompare(b.label))
}

function layoutOrientation(options: ModuleGraphLayoutOptions): ModuleGraphLayoutOrientation {
  return options.orientation ?? 'portrait'
}

/** Score a column count: prefer full grids (2×2, 1×3) over ragged last rows (3+1). */
function scoreColLayout(n: number, cols: number): number {
  const rows = Math.ceil(n / cols)
  const lastRow = n % cols || cols
  const orphans = cols - lastRow
  let score = 0
  if (orphans === 0) score += 100
  else score -= orphans * 28
  score -= Math.abs(rows - cols) * 6
  if (rows === 1 && n > 3) score -= (n - 3) * 4
  if (cols === 1 && n > 3) score -= (n - 3) * 6
  return score
}

/** Pick the most balanced column count that fits inner width. */
function chooseBalancedCols(n: number, innerWidth: number): number {
  if (n <= 1) return 1
  let best = 1
  let bestScore = -Infinity
  for (let cols = Math.min(n, MAX_FLEX_COLS); cols >= 1; cols--) {
    const cellW = (innerWidth - GRID_GAP * (cols - 1)) / cols
    if (cellW < MIN_CELL_W) continue
    const score = scoreColLayout(n, cols)
    if (score > bestScore || (score === bestScore && cols > best)) {
      bestScore = score
      best = cols
    }
  }
  return best
}

function idealBalancedCols(n: number): number {
  if (n <= 1) return 1
  let best = 1
  let bestScore = -Infinity
  for (let cols = Math.min(n, MAX_FLEX_COLS); cols >= 1; cols--) {
    const score = scoreColLayout(n, cols)
    if (score > bestScore || (score === bestScore && cols > best)) {
      bestScore = score
      best = cols
    }
  }
  return best
}

/** Landscape: fill rows first (legacy / tests). */
function targetLandscapeCols(n: number): number {
  if (n <= 1) return 1
  if (n <= 3) return n
  if (n === 4) return 2
  return Math.ceil(n / 2)
}

function innerWidthForCols(cols: number): number {
  return cols * MIN_CELL_W + Math.max(0, cols - 1) * GRID_GAP
}

function chooseGridCols(
  n: number,
  innerWidth: number,
  _itemHeights: number[],
  orientation: ModuleGraphLayoutOrientation
): number {
  if (n <= 1) return 1
  if (orientation === 'portrait') return chooseBalancedCols(n, innerWidth)
  const target = targetLandscapeCols(n)
  let cols = target
  while (cols > 1) {
    const cellW = (innerWidth - GRID_GAP * (cols - 1)) / cols
    if (cellW >= MIN_CELL_W) break
    cols--
  }
  return cols
}

function layoutGrid(
  items: GridItem[],
  originX: number,
  originY: number,
  innerWidth: number,
  orientation: ModuleGraphLayoutOrientation
): { placements: Record<string, { x: number; y: number; w: number; h: number }>; height: number; cols: number } {
  const n = items.length
  if (n === 0) return { placements: {}, height: 0, cols: 1 }
  const heights = items.map((i) => i.h)
  const cols = chooseGridCols(n, innerWidth, heights, orientation)
  const cellW = (innerWidth - GRID_GAP * (cols - 1)) / cols
  const rows = Math.ceil(n / cols)
  const placements: Record<string, { x: number; y: number; w: number; h: number }> = {}
  let y = originY
  let idx = 0
  for (let r = 0; r < rows; r++) {
    let rowH = CHIP_H
    const rowItems: GridItem[] = []
    for (let c = 0; c < cols && idx < n; c++, idx++) {
      const item = items[idx]!
      rowItems.push(item)
      rowH = Math.max(rowH, item.h)
    }
    let x = originX
    for (const item of rowItems) {
      placements[item.nodeId] = { x, y, w: cellW, h: rowH }
      x += cellW + GRID_GAP
    }
    y += rowH + GRID_GAP
  }
  return { placements, height: y - originY - GRID_GAP, cols }
}

/** Measure submodule children at equal cell widths and build flex grid items. */
function submoduleGridItems(
  childModuleIds: string[],
  availInner: number,
  graph: ModuleGraph,
  childrenByParent: Map<string, ModuleGraphNode[]>,
  naturalCache: Map<string, MeasuredModule>,
  options: ModuleGraphLayoutOptions,
  orientation: ModuleGraphLayoutOrientation
): { items: GridItem[]; cols: number; innerW: number; height: number } {
  const n = childModuleIds.length
  if (n === 0) return { items: [], cols: 1, innerW: availInner, height: 0 }
  const cols = chooseBalancedCols(n, availInner)
  const cellW = (availInner - GRID_GAP * Math.max(0, cols - 1)) / cols
  const items: GridItem[] = childModuleIds.map((id) => {
    const m = measureCompound(id, graph, childrenByParent, naturalCache, options, undefined, cellW)
    return {
      nodeId: id,
      w: cellW,
      h: Math.max(HEADER_H + PAD, m?.height ?? HEADER_H + PAD)
    }
  })
  const grid = layoutGrid(items, 0, 0, availInner, orientation)
  return { items, cols: grid.cols, innerW: availInner, height: SECTION_TITLE_H + grid.height }
}

function planSectionGrid(
  items: GridItem[],
  minInnerW: number,
  orientation: ModuleGraphLayoutOrientation
): { cols: number; innerW: number; height: number; cellW: number } {
  const n = items.length
  if (n === 0) return { cols: 1, innerW: minInnerW, height: 0, cellW: minInnerW }
  const dryCols = chooseGridCols(n, minInnerW, [], orientation)
  let innerW = Math.max(minInnerW, innerWidthForCols(dryCols))
  const dry = layoutGrid(items, 0, 0, innerW, orientation)
  innerW = Math.max(minInnerW, innerWidthForCols(dry.cols))
  const final = layoutGrid(items, 0, 0, innerW, orientation)
  const cellW = (innerW - GRID_GAP * (final.cols - 1)) / final.cols
  return {
    cols: final.cols,
    innerW,
    height: SECTION_TITLE_H + final.height,
    cellW
  }
}

function measureCompound(
  moduleId: string,
  graph: ModuleGraph,
  childrenByParent: Map<string, ModuleGraphNode[]>,
  naturalCache: Map<string, MeasuredModule>,
  options: ModuleGraphLayoutOptions,
  bounds?: MeasureBounds,
  widthHint?: number
): MeasuredModule | null {
  const mod = graph.nodes.find((n) => n.id === moduleId && n.kind === 'module')
  if (!mod) return null

  const q = (options.searchQuery ?? '').trim().toLowerCase()
  const tidy = options.tidy ?? false
  const orientation = layoutOrientation(options)
  const childMods = childrenByParent.get(moduleId) ?? []
  const processes = graph.nodes.filter((n) => n.parentId === moduleId && n.kind === 'process')
  const functions = graph.nodes.filter((n) => n.parentId === moduleId && n.kind === 'function')

  const titleW = textWidth(mod.name)
  const capInnerW = widthHint ? Math.max(MIN_CELL_W, widthHint - PAD * 2) : undefined
  const clampInner = (w: number) => (capInnerW !== undefined ? Math.min(w, capInnerW) : w)
  let innerW = capInnerW ?? Math.max(titleW - PAD * 2, innerWidthForCols(1))
  const sections: CompoundSection[] = []
  let y = HEADER_H

  const visibleChildren = sortRows(
    childMods
      .filter((c) => {
        const node = graph.nodes.find((n) => n.id === c.id)
        return node && (!q || matchesQuery(node.name, q))
      })
      .map((c) => {
        const node = graph.nodes.find((n) => n.id === c.id)!
        return {
          nodeId: c.id,
          kind: 'submodule' as const,
          label: node.name,
          moduleName: c.id,
          compact: false
        }
      }),
    tidy
  )

  if (visibleChildren.length > 0) {
    const plan = submoduleGridItems(
      visibleChildren.map((c) => c.moduleName),
      clampInner(innerW),
      graph,
      childrenByParent,
      naturalCache,
      options,
      orientation
    )
    innerW = clampInner(Math.max(innerW, plan.innerW))

    sections.push({
      key: 'submodules',
      titleKey: 'visual.graph.section.submodules',
      rows: visibleChildren,
      y,
      height: plan.height,
      cols: plan.cols
    })
    y += plan.height
  }

  const procRows: CompoundRow[] = sortRows(
    processes.map((p) => {
      const label = decorateProcessLabel(p.name, options.processMeta?.[p.id])
      return {
        nodeId: p.id,
        kind: 'process' as const,
        label,
        moduleName: moduleId,
        processName: p.name,
        hidden: Boolean(q && !matchesQuery(p.name, q) && !matchesQuery(label, q) && !matchesQuery(mod.name, q))
      }
    }),
    tidy
  )
  const visibleProcs = procRows.filter((r) => !r.hidden)
  if (visibleProcs.length > 0) {
    const items = visibleProcs.map((r) => ({ nodeId: r.nodeId, w: textWidth(r.label), h: CHIP_H }))
    const plan = planSectionGrid(items, clampInner(innerW), orientation)
    innerW = clampInner(Math.max(innerW, plan.innerW))
    sections.push({
      key: 'processes',
      titleKey: 'visual.graph.section.processes',
      rows: procRows,
      y,
      height: plan.height,
      cols: plan.cols
    })
    y += plan.height
  }

  const fnRows: CompoundRow[] = sortRows(
    functions.map((f) => ({
      nodeId: f.id,
      kind: 'function' as const,
      label: f.name,
      moduleName: moduleId,
      functionName: f.name,
      hidden: Boolean(q && !matchesQuery(f.name, q) && !matchesQuery(mod.name, q))
    })),
    tidy
  )
  const visibleFns = fnRows.filter((r) => !r.hidden)
  if (visibleFns.length > 0) {
    const items = visibleFns.map((r) => ({ nodeId: r.nodeId, w: textWidth(r.label), h: CHIP_H }))
    const plan = planSectionGrid(items, clampInner(innerW), orientation)
    innerW = clampInner(Math.max(innerW, plan.innerW))
    sections.push({
      key: 'functions',
      titleKey: 'visual.graph.section.functions',
      rows: fnRows,
      y,
      height: plan.height,
      cols: plan.cols
    })
    y += plan.height
  }

  if (q && !matchesQuery(mod.name, q) && sections.length === 0) return null

  const minModuleW = widthHint ? MIN_CELL_W : MIN_W
  let width = widthHint ? Math.max(minModuleW, widthHint) : Math.max(MIN_W, innerW + PAD * 2, titleW)
  let height = Math.max(HEADER_H + PAD, y + PAD)
  let compact = false

  if (bounds?.maxW && width > bounds.maxW) {
    width = Math.max(MIN_CELL_W, bounds.maxW)
    compact = true
  }
  if (bounds?.maxH && height > bounds.maxH) {
    height = Math.max(COMPACT_CHIP_H, bounds.maxH)
    compact = true
  }

  if (compact && bounds) {
    return { width, height: Math.min(height, COMPACT_CHIP_H + PAD), sections: [], compact: true }
  }

  return { width, height, sections, compact: false }
}

type MeasureAllResult = {
  cache: Map<string, MeasuredModule>
  natural: Map<string, MeasuredModule>
}

function measureAll(
  graph: ModuleGraph,
  childrenByParent: Map<string, ModuleGraphNode[]>,
  options: ModuleGraphLayoutOptions
): MeasureAllResult {
  const moduleIds = graph.nodes.filter((n) => n.kind === 'module').map((n) => n.id)
  const natural = new Map<string, MeasuredModule>()
  const cache = new Map<string, MeasuredModule>()

  function measureNatural(id: string): void {
    if (natural.has(id)) return
    for (const child of childrenByParent.get(id) ?? []) measureNatural(child.id)
    const m = measureCompound(id, graph, childrenByParent, natural, options)
    if (m) natural.set(id, m)
  }

  for (const id of moduleIds) measureNatural(id)

  function measureBounded(id: string, bounds?: MeasureBounds): void {
    if (cache.has(id)) return
    for (const child of childrenByParent.get(id) ?? []) measureBounded(child.id)
    const m = measureCompound(id, graph, childrenByParent, natural, options, bounds)
    if (m) cache.set(id, m)
    else cache.set(id, { width: MIN_W, height: HEADER_H, sections: [], compact: true })
  }

  for (const id of moduleIds) measureBounded(id)
  return { cache, natural }
}

function layoutCompound(
  moduleId: string,
  absX: number,
  absY: number,
  depth: number,
  graph: ModuleGraph,
  measureCache: Map<string, MeasuredModule>,
  naturalCache: Map<string, MeasuredModule>,
  childrenByParent: Map<string, ModuleGraphNode[]>,
  options: ModuleGraphLayoutOptions,
  out: CompoundModule[],
  cellBounds?: { w: number; h: number },
  forceCompact?: boolean
): CompoundModule | null {
  const measured = measureCache.get(moduleId)
  if (!measured) return null

  const mod = graph.nodes.find((n) => n.id === moduleId)!
  const width = cellBounds?.w ?? measured.width
  const height = cellBounds?.h ?? measured.height
  const isCompact = forceCompact ?? measured.compact

  const compound: CompoundModule = {
    moduleId,
    name: mod.name,
    moduleRole: mod.moduleRole,
    x: absX,
    y: absY,
    width,
    height,
    depth,
    compact: isCompact,
    sections: isCompact ? [] : measured.sections,
    rowByNodeId: {}
  }

  out.push(compound)

  if (isCompact) return compound

  const innerW = width - PAD * 2

  for (const sec of measured.sections) {
    const visible = sec.rows.filter((r) => !r.hidden)
    const originY = absY + sec.y + SECTION_TITLE_H

    if (sec.key === 'submodules') {
      const orientation = layoutOrientation(options)
      const { items } = submoduleGridItems(
        visible.map((row) => row.moduleName),
        innerW,
        graph,
        childrenByParent,
        naturalCache,
        options,
        orientation
      )
      const { placements } = layoutGrid(items, absX + PAD, originY, innerW, orientation)
      for (const row of visible) {
        const pl = placements[row.nodeId]
        if (!pl) continue
        compound.rowByNodeId[row.nodeId] = pl
        const childMeasured = measureCompound(
          row.moduleName,
          graph,
          childrenByParent,
          naturalCache,
          options,
          undefined,
          pl.w
        )
        if (childMeasured) measureCache.set(row.moduleName, childMeasured)
        layoutCompound(
          row.moduleName,
          pl.x,
          pl.y,
          depth + 1,
          graph,
          measureCache,
          naturalCache,
          childrenByParent,
          options,
          out,
          { w: pl.w, h: pl.h }
        )
      }
    } else {
      const items: GridItem[] = visible.map((row) => ({
        nodeId: row.nodeId,
        w: textWidth(row.label),
        h: CHIP_H
      }))
      const { placements } = layoutGrid(items, absX + PAD, originY, innerW, layoutOrientation(options))
      Object.assign(compound.rowByNodeId, placements)
    }
  }

  return compound
}

function suggestDefaultRootWidth(
  moduleId: string,
  graph: ModuleGraph,
  childrenByParent: Map<string, ModuleGraphNode[]>,
  naturalCache: Map<string, MeasuredModule>,
  options: ModuleGraphLayoutOptions
): number {
  const mod = graph.nodes.find((n) => n.id === moduleId && n.kind === 'module')
  if (!mod) return MIN_W

  const counts = [
    (childrenByParent.get(moduleId) ?? []).length,
    graph.nodes.filter((n) => n.parentId === moduleId && n.kind === 'process').length,
    graph.nodes.filter((n) => n.parentId === moduleId && n.kind === 'function').length
  ].filter((c) => c > 0)

  if (counts.length === 0) return MIN_W

  let maxInner = innerWidthForCols(1)
  for (const n of counts) {
    maxInner = Math.max(maxInner, innerWidthForCols(idealBalancedCols(n)))
  }

  const titleW = textWidth(mod.name)
  let width = Math.max(MIN_W, maxInner + PAD * 2, titleW)

  // Pick width whose measured aspect ratio is closest to square (content height, no padding).
  let bestW = width
  let bestAspect = Infinity
  for (let w = width; w <= width + 480; w += 40) {
    const m = measureCompound(moduleId, graph, childrenByParent, naturalCache, options, undefined, w)
    if (!m) continue
    const aspect = m.width / Math.max(m.height, 1)
    const dist = Math.abs(Math.log(aspect))
    if (dist < bestAspect) {
      bestAspect = dist
      bestW = w
    }
    if (aspect >= 0.85 && aspect <= 1.2) break
  }
  return bestW
}

function rowCenter(compounds: CompoundModule[], nodeId: string): { x: number; y: number } | null {
  for (const c of compounds) {
    const rect = c.rowByNodeId[nodeId]
    if (rect) return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
  }
  return null
}

export function buildModuleGraphLayout(
  graph: ModuleGraph,
  searchQueryOrOptions: string | ModuleGraphLayoutOptions = ''
): ModuleGraphLayout {
  const options: ModuleGraphLayoutOptions =
    typeof searchQueryOrOptions === 'string'
      ? { searchQuery: searchQueryOrOptions }
      : searchQueryOrOptions

  const moduleNodes = graph.nodes.filter((n) => n.kind === 'module')
  const childrenByParent = new Map<string, ModuleGraphNode[]>()
  for (const m of moduleNodes) {
    if (!m.parentId) continue
    const list = childrenByParent.get(m.parentId) ?? []
    list.push(m)
    childrenByParent.set(m.parentId, list)
  }

  let roots = moduleNodes.filter(
    (m) => !m.parentId || !moduleNodes.some((p) => p.id === m.parentId)
  )
  if (options.tidy) {
    roots = [...roots].sort((a, b) => a.name.localeCompare(b.name))
  }

  const { cache: measureCache, natural: naturalCache } = measureAll(graph, childrenByParent, options)
  const compounds: CompoundModule[] = []

  let y = LAYOUT_ORIGIN_Y
  for (const root of roots) {
    const sizeOverride = options.moduleSizes?.[root.id]
    const rootW =
      sizeOverride?.width ??
      suggestDefaultRootWidth(root.id, graph, childrenByParent, naturalCache, options)
    const remeasured = measureCompound(
      root.id,
      graph,
      childrenByParent,
      naturalCache,
      options,
      undefined,
      rootW
    )
    if (remeasured) measureCache.set(root.id, remeasured)
    if (!measureCache.has(root.id)) continue
    const measured = measureCache.get(root.id)!
    const rootH = sizeOverride
      ? Math.max(measured.height, sizeOverride.height ?? 0)
      : measured.height
    layoutCompound(
      root.id,
      40,
      y,
      0,
      graph,
      measureCache,
      naturalCache,
      childrenByParent,
      options,
      compounds,
      { w: rootW, h: rootH }
    )
    const placed = compounds.find((c) => c.moduleId === root.id)
    if (placed) y += placed.height + MODULE_GAP_Y
  }

  let minX = 0
  let minY = 0
  let maxX = 480
  let maxY = 320
  for (const c of compounds) {
    minX = Math.min(minX, c.x)
    minY = Math.min(minY, c.y)
    maxX = Math.max(maxX, c.x + c.width)
    maxY = Math.max(maxY, c.y + c.height)
  }

  const edges: DrawableGraphEdge[] = drawableGraphEdges(graph)
    .map((e) => {
      const from = rowCenter(compounds, e.from)
      const to = rowCenter(compounds, e.to)
      if (!from || !to) return null
      return { ...e, x1: from.x, y1: from.y, x2: to.x, y2: to.y }
    })
    .filter((e): e is DrawableGraphEdge => e !== null)

  return { compounds, edges, bbox: { minX, minY, maxX, maxY } }
}
