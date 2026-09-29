/**
 * Apply audit-log decisions to static grain observations.
 * Text edits do not erase sticky obligations unless a grain step closed them.
 */

import type { GrainVariation, ProcessGrain, ProcessGrainReport, VariationDisposition } from '@agile-sofl/parser'

export interface GrainLogEntry {
  kind: string
  target: string
  grainKeysBefore?: string[]
  grainKeysAfter?: string[]
}

export interface GrainStepInput {
  kind: string
  moduleName?: string
  processName?: string
  grainClass?: string
  variationId?: string
  disposition?: string
  toText?: string
}

export type GrainClass = 'operation' | 'abstract' | 'unclassified'

export interface ClosedVariation extends GrainVariation {
  childName?: string
}

export interface ClosedProcessGrain extends ProcessGrain {
  grainClass: GrainClass
  variations: ClosedVariation[]
  obligationIds: string[]
  grainClosed: boolean
}

interface Resolution {
  disposition: VariationDisposition
  childName?: string
}

export function grainStepTarget(step: GrainStepInput): string | null {
  if (step.kind === 'ClassifyGrain' && step.moduleName && step.processName && step.grainClass) {
    return `ClassifyGrain::${step.moduleName}::${step.processName}::${step.grainClass}`
  }
  if (
    step.kind === 'ResolveVariation' &&
    step.moduleName &&
    step.processName &&
    step.variationId &&
    step.disposition
  ) {
    const child = step.disposition === 'child' ? step.toText?.trim() || '-' : '-'
    return `ResolveVariation::${step.moduleName}::${step.processName}::${step.variationId}::${step.disposition}::${child}`
  }
  return null
}

export function closeProcessGrain(report: ProcessGrainReport, log: GrainLogEntry[]): ClosedProcessGrain[] {
  const classes = new Map<string, Exclude<GrainClass, 'unclassified'>>()
  const resolutions = new Map<string, Resolution>()
  for (const entry of log) {
    const parts = entry.target.split('::')
    if (entry.kind === 'ClassifyGrain' && (parts[3] === 'operation' || parts[3] === 'abstract')) {
      classes.set(`${parts[1]}::${parts[2]}`, parts[3])
    }
    if (entry.kind === 'ResolveVariation' && parts.length >= 6) {
      const disposition = parts[4] as VariationDisposition
      if (disposition === 'scenario' || disposition === 'child' || disposition === 'waived') {
        resolutions.set(`${parts[1]}::${parts[2]}::${parts[3]}`, {
          disposition,
          childName: disposition === 'child' && parts[5] !== '-' ? parts[5] : undefined
        })
      }
    }
  }

  return report.processes.map((row) => {
    const grainClass = classes.get(`${row.moduleName}::${row.processName}`) ?? 'unclassified'
    const variations: ClosedVariation[] = row.variations.map((variation) => {
      const found = resolutions.get(`${row.moduleName}::${row.processName}::${variation.id}`)
      return found ? { ...variation, disposition: found.disposition, childName: found.childName } : variation
    })
    for (const [key, resolution] of resolutions) {
      const prefix = `${row.moduleName}::${row.processName}::`
      if (!key.startsWith(prefix)) continue
      const id = key.slice(prefix.length)
      if (variations.some((variation) => variation.id === id)) continue
      variations.push({
        id,
        text: id === 'name-claim' ? row.processName : id,
        source: 'step',
        disposition: resolution.disposition,
        childName: resolution.childName
      })
    }
    const obligationIds = obligations({ ...row, grainClass, variations })
    const grainClosed = obligationIds.length === 0 && (row.hasDecom || grainClass === 'operation')
    return { ...row, grainClass, variations, obligationIds, grainClosed }
  })
}

function obligations(row: ClosedProcessGrain | (ProcessGrain & { grainClass: GrainClass; variations: ClosedVariation[] })): string[] {
  const ids: string[] = []
  const key = `${row.moduleName}:${row.processName}`
  if (!row.hasDecom && row.grainClass === 'unclassified') ids.push(`unclassified:${key}`)
  if (!row.hasDecom && row.grainClass === 'abstract') ids.push(`abstract-leaf:${key}`)
  if (!row.hasDecom && row.nameEffectMismatch) ids.push(`mismatch:${key}`)
  if (!row.hasDecom && row.effectPattern === 'mixed') ids.push(`mixed:${key}`)
  for (const variation of row.variations) {
    if (variation.disposition === 'unresolved') ids.push(`variation:${key}:${variation.id}`)
    if (variation.disposition === 'child') {
      const name = variation.childName
      if (!name || !row.childProcessNames.includes(name)) ids.push(`child:${key}:${variation.id}`)
    }
  }
  const scenarios = row.variations.filter((variation) => variation.disposition === 'scenario')
  if (scenarios.length > 0 && scenarios.length !== row.derivedScenarioCount) ids.push(`scenario-gap:${key}`)
  return ids
}

export function stickyGrainIds(ids: string[]): string[] {
  return ids.filter((id) => /^(unclassified|abstract-leaf|mismatch|variation|mixed):/.test(id))
}

/** Obligation ids a grain or decompose step is allowed to remove. */
export function grainKeysClosedByLog(log: GrainLogEntry[]): Set<string> {
  const closed = new Set<string>()
  for (const entry of log) {
    const parts = entry.target.split('::')
    if (entry.kind === 'ClassifyGrain' && parts[1] && parts[2]) {
      closed.add(`unclassified:${parts[1]}:${parts[2]}`)
    }
    if (entry.kind === 'ResolveVariation' && parts[1] && parts[2] && parts[3]) {
      closed.add(`variation:${parts[1]}:${parts[2]}:${parts[3]}`)
      if (parts[3] === 'name-claim') closed.add(`mismatch:${parts[1]}:${parts[2]}`)
      if (parts[4] === 'child') closed.add(`child:${parts[1]}:${parts[2]}:${parts[3]}`)
    }
    if (entry.kind === 'DecomposeProcess' && parts[1] && parts[2]) {
      const key = `${parts[1]}:${parts[2]}`
      closed.add(`unclassified:${key}`)
      closed.add(`abstract-leaf:${key}`)
      closed.add(`mismatch:${key}`)
      closed.add(`mixed:${key}`)
    }
  }
  return closed
}

export function unloggedGrainClosures(currentSticky: string[], log: GrainLogEntry[]): number {
  const historical = new Set<string>()
  for (const entry of log) {
    for (const key of entry.grainKeysBefore ?? []) historical.add(key)
    for (const key of entry.grainKeysAfter ?? []) historical.add(key)
  }
  if (historical.size === 0) return 0
  const current = new Set(currentSticky)
  const closed = grainKeysClosedByLog(log)
  let extra = 0
  for (const key of historical) {
    if (!current.has(key) && !closed.has(key)) extra += 1
  }
  return extra
}
