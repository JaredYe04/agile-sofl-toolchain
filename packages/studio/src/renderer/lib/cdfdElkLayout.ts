import { layoutCdfdGraph, type CdfdGraph, type CdfdLayout } from '../lib/editorApiRenderer'

/**
 * Adaptive CDFD layout: elkjs layered algorithm when available, otherwise the
 * built-in layered fallback. Source text never stores coordinates.
 */
export async function layoutCdfdGraphAdaptive(graph: CdfdGraph): Promise<CdfdLayout> {
  const fallback = layoutCdfdGraph(graph)
  if (!graph.nodes?.length) return fallback
  try {
    const mod = await import('elkjs/lib/elk.bundled.js')
    const Ctor = (mod as { default?: unknown }).default ?? mod
    const elk = new (Ctor as new () => {
      layout: (g: unknown) => Promise<{
        children?: Array<{ id: string; x?: number; y?: number; width?: number; height?: number }>
        edges?: Array<{
          id: string
          sections?: Array<{
            startPoint: { x: number; y: number }
            endPoint: { x: number; y: number }
            bendPoints?: Array<{ x: number; y: number }>
          }>
        }>
      }>
    })()
    const laid = await elk.layout({
      id: graph.moduleName || 'cdfd',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.layered.spacing.nodeNodeBetweenLayers': '48',
        'elk.spacing.nodeNode': '24',
        'elk.edgeRouting': 'ORTHOGONAL'
      },
      children: fallback.nodes.map((n) => ({ id: n.id, width: n.width, height: n.height })),
      edges: graph.edges.map((e) => ({ id: e.id, sources: [e.from], targets: [e.to] }))
    })
    const pos = new Map((laid.children ?? []).map((c) => [c.id, c]))
    const nodes = fallback.nodes.map((n) => {
      const p = pos.get(n.id)
      return p ? { ...n, x: p.x ?? n.x, y: p.y ?? n.y } : n
    })
    const byId = new Map(graph.edges.map((e) => [e.id, e]))
    const edges = (laid.edges ?? []).map((e) => {
      const src = byId.get(e.id)
      const section = e.sections?.[0]
      const points = section
        ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]
        : fallback.edges.find((x) => x.id === e.id)?.points ?? []
      return {
        id: e.id,
        from: src?.from ?? '',
        to: src?.to ?? '',
        points,
        guard: src?.guard,
        isOthers: src?.isOthers
      }
    })
    let minX = 0
    let minY = 0
    let maxX = 400
    let maxY = 240
    for (const n of nodes) {
      maxX = Math.max(maxX, n.x + n.width)
      maxY = Math.max(maxY, n.y + n.height)
    }
    return {
      nodes,
      edges: edges.length ? edges : fallback.edges,
      bbox: { minX, minY, maxX: maxX + 24, maxY: maxY + 24 }
    }
  } catch {
    return fallback
  }
}
