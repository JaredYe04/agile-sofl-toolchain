import { parse } from '@agile-sofl/parser'
import type { CoverageReport, CoverageItem, TraceabilityGraph } from '../model.js'
import { parseAspec } from '../parse.js'
import { contentHash } from '../buildInformalModel.js'

function countFsfScenarios(asflSource: string, processName: string): number {
  const { ast } = parse(asflSource)
  if (!ast || ast.type !== 'program') return 0
  for (const mod of ast.modules) {
    for (const proc of mod.processes) {
      if (proc.name === processName && proc.body?.fsf) {
        let count = proc.body.fsf.scenarios.length
        if (proc.body.fsf.others) count += 1
        return count
      }
    }
  }
  return 0
}

function processExists(asflSource: string, name: string): boolean {
  const { ast } = parse(asflSource)
  if (!ast || ast.type !== 'program') return false
  for (const mod of ast.modules) {
    if (mod.processes.some((p) => p.name === name)) return true
  }
  return false
}

import { aspecTagToken } from '../refine/fsfBuilder.js'

function hasAspecTag(asflSource: string, aspecId: string): boolean {
  return asflSource.includes(aspecTagToken(aspecId))
}

export function buildCoverageReport(
  aspecSource: string,
  asflSource: string,
  trace?: TraceabilityGraph | null
): CoverageReport {
  const { document } = parseAspec(aspecSource)
  const items: CoverageItem[] = []
  let covered = 0
  let partial = 0
  let missing = 0
  let stale = 0

  const isStale =
    trace?.contentHash != null && trace.contentHash !== contentHash(aspecSource)

  if (!document) {
    return { total: 0, covered: 0, partial: 0, missing: 0, stale: 0, percent: 0, items: [] }
  }

  for (const mod of document.modules) {
    for (const ty of mod.types ?? []) {
      const exists = asflSource.includes(`${ty.name} =`) || asflSource.includes(`${ty.name};`)
      items.push({
        aspecId: ty.id,
        kind: 'type',
        name: ty.name,
        status: isStale ? 'stale' : exists ? 'covered' : 'missing'
      })
      if (isStale) stale++
      else if (exists) covered++
      else missing++
    }
    for (const v of mod.variables ?? []) {
      const exists = new RegExp(`\\b${v.name}\\s*:`).test(asflSource)
      items.push({
        aspecId: v.id,
        kind: 'variable',
        name: v.name,
        status: isStale ? 'stale' : exists ? 'covered' : 'missing'
      })
      if (isStale) stale++
      else if (exists) covered++
      else missing++
    }
    for (const inv of mod.invariants ?? []) {
      const hint = inv.textHint?.trim()
      const exists = hint ? asflSource.includes(hint.slice(0, Math.min(20, hint.length))) : false
      items.push({
        aspecId: inv.id,
        kind: 'invariant',
        name: inv.id,
        status: isStale ? 'stale' : exists ? 'covered' : hint ? 'partial' : 'missing'
      })
      if (isStale) stale++
      else if (exists) covered++
      else if (hint) partial++
      else missing++
    }
    for (const proc of mod.processes ?? []) {
      let status: CoverageItem['status'] = 'missing'
      const exists = processExists(asflSource, proc.name)
      const scenCount = proc.scenarios?.length ?? 0
      const fsfCount = countFsfScenarios(asflSource, proc.name)
      const tagged = hasAspecTag(asflSource, proc.id)

      if (isStale && trace?.links.some((l) => l.aspecId === proc.id)) {
        status = 'stale'
        stale++
      } else if (!exists) {
        status = 'missing'
        missing++
      } else if (fsfCount >= scenCount && tagged) {
        status = 'covered'
        covered++
      } else {
        status = 'partial'
        partial++
      }

      items.push({
        aspecId: proc.id,
        kind: 'process',
        name: proc.name,
        status,
        detail: exists ? `FSF scenarios: ${fsfCount}/${Math.max(scenCount, 1)}` : undefined
      })
    }

    for (const fn of mod.functions ?? []) {
      const { ast } = parse(asflSource)
      let exists = false
      let hasBody = false
      let hasFsf = false
      if (ast?.type === 'program') {
        for (const m of ast.modules) {
          const found = m.functions.find((f) => f.name === fn.name)
          if (found) {
            exists = true
            hasBody = !found.isUndefined && Boolean(found.body)
            hasFsf = Boolean(found.fsf)
          }
        }
      }
      const tagged = hasAspecTag(asflSource, fn.id)
      let status: CoverageItem['status'] = 'missing'
      if (isStale && trace?.links.some((l) => l.aspecId === fn.id)) {
        status = 'stale'
        stale++
      } else if (!exists) {
        status = 'missing'
        missing++
      } else if ((hasBody || hasFsf) && tagged) {
        status = 'covered'
        covered++
      } else if (exists) {
        status = 'partial'
        partial++
      } else {
        missing++
      }
      items.push({ aspecId: fn.id, kind: 'function', name: fn.name, status })
    }
  }

  const total = items.length
  const percent = total === 0 ? 100 : Math.round((covered / total) * 100)

  return { total, covered, partial, missing, stale, percent, items }
}

export function mergeTraceability(
  existing: TraceabilityGraph,
  incoming: TraceabilityGraph
): TraceabilityGraph {
  const byId = new Map(existing.links.map((l) => [l.aspecId + ':' + l.kind, l]))
  for (const link of incoming.links) {
    byId.set(link.aspecId + ':' + link.kind, link)
  }
  return {
    ...incoming,
    links: [...byId.values()]
  }
}

export function parseTraceJson(json: string): TraceabilityGraph | null {
  try {
    return JSON.parse(json) as TraceabilityGraph
  } catch {
    return null
  }
}
