import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from '@agile-sofl/parser'
import { buildModuleGraph, drawableGraphEdges } from '../src/moduleGraph.js'
import { buildModuleGraphLayout, decorateProcessLabel } from '../src/moduleGraphLayout.js'

const hospital = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../examples/hospital-registration.asfl'),
  'utf8'
)
const graphShowcase = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../examples/graph-showcase.asfl'),
  'utf8'
)
const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), '../../parser/tests/fixtures/grammar')

function findParentOf(compounds: ReturnType<typeof buildModuleGraphLayout>['compounds'], childId: string) {
  const child = compounds.find((c) => c.moduleId === childId)
  if (!child || child.depth <= 0) return null
  return compounds
    .filter((c) => c.depth === child.depth - 1)
    .find((p) => child.x >= p.x && child.y >= p.y && child.x + child.width <= p.x + p.width + 1 && child.y + child.height <= p.y + p.height + 1)
}

describe('buildModuleGraphLayout', () => {
  it('builds compound modules with process sections', () => {
    const { ast } = parse(hospital)
    expect(ast).not.toBeNull()
    const graph = buildModuleGraph(ast!)
    const layout = buildModuleGraphLayout(graph)
    const hospitalCompound = layout.compounds.find((c) => c.moduleId === 'Hospital')
    expect(hospitalCompound).toBeDefined()
    expect(hospitalCompound!.sections.some((s) => s.key === 'processes')).toBe(true)
  })

  it('drawable edges have valid coordinates', () => {
    const { ast } = parse(hospital)
    const graph = buildModuleGraph(ast!)
    const layout = buildModuleGraphLayout(graph)
    for (const e of layout.edges) {
      expect(e.x1 !== 0 || e.y1 !== 0 || e.x2 !== 0 || e.y2 !== 0).toBe(true)
    }
  })

  it('does not emit unresolved decom edges', () => {
    const { ast } = parse(hospital)
    const graph = buildModuleGraph(ast!)
    const drawable = drawableGraphEdges(graph)
    for (const e of drawable) {
      expect(graph.nodes.some((n) => n.id === e.to)).toBe(true)
    }
  })

  it('uses single-column portrait grid when inner width is narrow', () => {
    const { ast } = parse(hospital)
    const graph = buildModuleGraph(ast!)
    const layout = buildModuleGraphLayout(graph, { moduleSizes: { Hospital: { width: 200 } } })
    const root = layout.compounds.find((c) => c.moduleId === 'Hospital' && c.depth === 0)
    const procSection = root?.sections.find((s) => s.key === 'processes')
    expect(procSection).toBeDefined()
    expect(procSection!.cols ?? 1).toBe(1)
    const placements = procSection!.rows
      .filter((r) => !r.hidden)
      .map((r) => root!.rowByNodeId[r.nodeId])
      .filter(Boolean)
    const ys = new Set(placements.map((p) => p!.y))
    expect(ys.size).toBeGreaterThan(1)
  })

  it('uses multi-column grid in landscape orientation', () => {
    const { ast } = parse(hospital)
    const graph = buildModuleGraph(ast!)
    const layout = buildModuleGraphLayout(graph, {
      orientation: 'landscape',
      moduleSizes: { Hospital: { width: 400 } }
    })
    const root = layout.compounds.find((c) => c.moduleId === 'Hospital' && c.depth === 0)
    const procSection = root?.sections.find((s) => s.key === 'processes')
    expect(procSection?.cols).toBe(2)
  })

  it('flexes submodule cells to parent width and increases columns when wider', () => {
    const { ast } = parse(graphShowcase)
    const graph = buildModuleGraph(ast!)
    const wide = buildModuleGraphLayout(graph, { moduleSizes: { SmartCity: { width: 600 } } })
    const narrow = buildModuleGraphLayout(graph, { moduleSizes: { SmartCity: { width: 240 } } })
    const rootWide = wide.compounds.find((c) => c.moduleId === 'SmartCity' && c.depth === 0)
    const rootNarrow = narrow.compounds.find((c) => c.moduleId === 'SmartCity' && c.depth === 0)
    expect(rootWide).toBeDefined()
    expect(rootNarrow).toBeDefined()
    const subWide = wide.compounds.find((c) => c.depth === 1)
    const subNarrow = narrow.compounds.find((c) => c.moduleId === subWide?.moduleId && c.depth === 1)
    expect(subWide).toBeDefined()
    expect(subNarrow).toBeDefined()
    expect((subNarrow?.width ?? 0)).toBeLessThan(subWide!.width)
    for (const child of narrow.compounds.filter((c) => c.depth === 1)) {
      expect(child.x + child.width).toBeLessThanOrEqual(rootNarrow!.x + rootNarrow!.width + 1)
    }
    const wideSubCols =
      rootWide?.sections.find((s) => s.key === 'submodules')?.cols ?? 1
    const narrowSubCols =
      rootNarrow?.sections.find((s) => s.key === 'submodules')?.cols ?? 1
    expect(wideSubCols).toBeGreaterThan(narrowSubCols)
  })

  it('nested submodules stay within parent bounds', () => {
    const { ast } = parse(hospital)
    const graph = buildModuleGraph(ast!)
    const layout = buildModuleGraphLayout(graph)
    for (const childId of ['Emergency', 'Billing', 'Records']) {
      const child = layout.compounds.find((c) => c.moduleId === childId)
      expect(child).toBeDefined()
      const parent = findParentOf(layout.compounds, childId)
      expect(parent).toBeDefined()
      expect(child!.x).toBeGreaterThanOrEqual(parent!.x)
      expect(child!.y).toBeGreaterThanOrEqual(parent!.y)
      expect(child!.x + child!.width).toBeLessThanOrEqual(parent!.x + parent!.width + 1)
      expect(child!.y + child!.height).toBeLessThanOrEqual(parent!.y + parent!.height + 1)
    }
  })

  it('tidy mode sorts section rows by label', () => {
    const { ast } = parse(hospital)
    const graph = buildModuleGraph(ast!)
    const layout = buildModuleGraphLayout(graph, { tidy: true })
    for (const compound of layout.compounds) {
      for (const section of compound.sections) {
        const visible = section.rows.filter((r) => !r.hidden).map((r) => r.label)
        const sorted = [...visible].sort((a, b) => a.localeCompare(b))
        expect(visible).toEqual(sorted)
      }
    }
  })

  it('nested submodules render as full compounds with sections', () => {
    const { ast } = parse(hospital)
    const graph = buildModuleGraph(ast!)
    const layout = buildModuleGraphLayout(graph)
    for (const childId of ['Emergency', 'Billing', 'Records']) {
      const child = layout.compounds.find((c) => c.moduleId === childId)
      expect(child).toBeDefined()
      expect(child!.compact).not.toBe(true)
      expect(child!.sections.length).toBeGreaterThan(0)
    }
  })

  it('uses 2 columns for exactly 4 process chips in landscape mode', () => {
    const { ast } = parse(hospital)
    const graph = buildModuleGraph(ast!)
    const layout = buildModuleGraphLayout(graph, {
      orientation: 'landscape',
      moduleSizes: { Hospital: { width: 400 } }
    })
    const root = layout.compounds.find((c) => c.moduleId === 'Hospital' && c.depth === 0)
    const procSection = root?.sections.find((s) => s.key === 'processes')
    expect(procSection?.cols).toBe(2)
  })

  it('uses more columns when root module is wider', () => {
    const { ast } = parse(hospital)
    const graph = buildModuleGraph(ast!)
    const narrow = buildModuleGraphLayout(graph, { moduleSizes: { Hospital: { width: 220 } } })
    const wide = buildModuleGraphLayout(graph, { moduleSizes: { Hospital: { width: 420 } } })
    const narrowCols =
      narrow.compounds.find((c) => c.moduleId === 'Hospital')?.sections.find((s) => s.key === 'processes')
        ?.cols ?? 1
    const wideCols =
      wide.compounds.find((c) => c.moduleId === 'Hospital')?.sections.find((s) => s.key === 'processes')
        ?.cols ?? 1
    expect(wideCols).toBeGreaterThan(narrowCols)
  })

  it('uses balanced default root layout closer to square with full grids', () => {
    const { ast } = parse(hospital)
    const graph = buildModuleGraph(ast!)
    const layout = buildModuleGraphLayout(graph)
    const root = layout.compounds.find((c) => c.moduleId === 'Hospital' && c.depth === 0)
    expect(root).toBeDefined()
    const aspect = root!.width / root!.height
    expect(aspect).toBeGreaterThan(0.35)
    expect(aspect).toBeLessThan(1.8)
    const procSection = root?.sections.find((s) => s.key === 'processes')
    expect(procSection?.cols).toBe(2)
  })

  it('prefers 2x2 over 3+1 for four process chips at sufficient width', () => {
    const { ast } = parse(hospital)
    const graph = buildModuleGraph(ast!)
    const layout = buildModuleGraphLayout(graph, { moduleSizes: { Hospital: { width: 360 } } })
    const procSection = layout.compounds
      .find((c) => c.moduleId === 'Hospital')
      ?.sections.find((s) => s.key === 'processes')
    expect(procSection?.cols).toBe(2)
  })

  it('reflows root module when moduleSizes width override is set', () => {
    const { ast } = parse(hospital)
    const graph = buildModuleGraph(ast!)
    const wide = buildModuleGraphLayout(graph, { moduleSizes: { Hospital: { width: 520 } } })
    const narrow = buildModuleGraphLayout(graph, { moduleSizes: { Hospital: { width: 220 } } })
    const rootWide = wide.compounds.find((c) => c.moduleId === 'Hospital' && c.depth === 0)
    const root = narrow.compounds.find((c) => c.moduleId === 'Hospital' && c.depth === 0)
    expect(root?.width).toBe(220)
    const wideSubCols =
      rootWide?.sections.find((s) => s.key === 'submodules')?.cols ?? 1
    const narrowSubCols = root?.sections.find((s) => s.key === 'submodules')?.cols ?? 1
    expect(wideSubCols).toBeGreaterThan(narrowSubCols)
    expect((root?.height ?? 0)).toBeGreaterThan(0)
  })

  it('lays out graph-showcase with nested submodules and portrait sections', () => {
    const { ast } = parse(graphShowcase)
    expect(ast).not.toBeNull()
    const graph = buildModuleGraph(ast!)
    const layout = buildModuleGraphLayout(graph)
    const root = layout.compounds.find((c) => c.moduleId === 'SmartCity' && c.depth === 0)
    expect(root).toBeDefined()
    expect(root!.sections.some((s) => s.key === 'submodules')).toBe(true)
    expect(root!.sections.some((s) => s.key === 'processes')).toBe(true)
    expect(layout.compounds.filter((c) => c.depth === 1).length).toBeGreaterThanOrEqual(5)
    expect(layout.edges.length).toBeGreaterThan(0)
    const aspect = (root!.width ?? 1) / (root!.height ?? 1)
    expect(aspect).toBeGreaterThan(0.4)
    const subSection = root!.sections.find((s) => s.key === 'submodules')
    expect((subSection?.cols ?? 1)).toBeGreaterThanOrEqual(2)
  })

  it('parents are painted before children via depth ordering', () => {
    const { ast } = parse(hospital)
    const graph = buildModuleGraph(ast!)
    const layout = buildModuleGraphLayout(graph)
    for (const child of layout.compounds) {
      if (child.depth <= 0) continue
      const parent = layout.compounds.find(
        (c) => c.depth === child.depth - 1 && child.y >= c.y && child.x >= c.x - 1
      )
      if (parent) {
        expect(parent.depth).toBeLessThan(child.depth)
      }
    }
  })

  it('decorates process labels with alias and init markers', () => {
    expect(decorateProcessLabel('Dup', { isAlias: true, aliasTarget: 'Sub.P' })).toBe('Dup =Sub.P')
    expect(decorateProcessLabel('Worker', { hasExt: true })).toBe('Worker')
    expect(decorateProcessLabel('Boot', { isInit: true })).toBe('Init')
    expect(decorateProcessLabel('Plain', {})).toBe('Plain')

    const source = readFileSync(join(fixtureRoot, 'processes/ext-alias.asfl'), 'utf8')
    const { ast } = parse(source)
    const graph = buildModuleGraph(ast!)
    const layout = buildModuleGraphLayout(graph, {
      processMeta: {
        'Proc::process::Dup': { isAlias: true, aliasTarget: 'Sub.P' },
        'Proc::process::Worker': { hasExt: true }
      }
    })
    const proc = layout.compounds
      .find((c) => c.moduleId === 'Proc')
      ?.sections.find((s) => s.key === 'processes')
    const labels = proc?.rows.map((r) => r.label) ?? []
    expect(labels).toContain('Dup =Sub.P')
    expect(labels).toContain('Worker')
  })
})
