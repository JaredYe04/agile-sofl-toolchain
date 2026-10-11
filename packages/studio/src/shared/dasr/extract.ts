import type { ImpactDeclaration } from './types'

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Element id for one patch operation.
 * Returns null when the operation cannot be mapped. Callers must then fail closed
 * rather than keep the ids they could guess.
 */
export function elementIdFromOperation(op: Record<string, unknown>): string | null {
  const kind = clean(op.op) || clean(op.action)
  if (kind === 'replace' || kind === 'append' || kind === 'replace-document' || kind === 'replace-html') {
    return null
  }
  const explicit = clean(op.id)
  if (explicit) return explicit
  if (kind === 'refine-step') {
    const moduleName = clean(op.moduleName)
    const processName = clean(op.processName)
    const typeName = clean(op.typeName)
    if (moduleName && processName) return `proc:${moduleName}.${processName}`
    if (moduleName && typeName) return `type:${moduleName}.${typeName}`
    return null
  }
  const screenId = clean(op.screenId)
  if (screenId) return `gui:${screenId}`
  if (kind === 'add-screen') {
    const id = clean(op.id) || clean(op.name)
    return id ? `gui:${id}` : null
  }
  return null
}

/** Whole-proposal impact. One unmapped operation makes the proposal unknown. */
export function extractImpactFromOperations(operations: Array<Record<string, unknown>> | undefined): ImpactDeclaration {
  if (!operations || operations.length === 0) return { kind: 'unknown' }
  const ids: string[] = []
  for (const op of operations) {
    const id = elementIdFromOperation(op)
    if (!id) return { kind: 'unknown' }
    ids.push(id)
  }
  return { kind: 'elements', ids: [...new Set(ids)] }
}

export interface ProposalImpactInput {
  operations?: Array<Record<string, unknown>>
  impactElementIds?: unknown
  impactUnknown?: unknown
  commitment?: unknown
}

/**
 * Model-declared ids cannot override an operation the gate cannot map
 * (source edit, whole-document replace). That would let source edit bypass the gate.
 */
export function resolveProposalImpact(input: ProposalImpactInput): ImpactDeclaration {
  if (input.impactUnknown === true) return { kind: 'unknown' }
  if (input.impactElementIds !== undefined && !Array.isArray(input.impactElementIds)) return { kind: 'malformed' }
  const extracted = extractImpactFromOperations(input.operations)
  if (extracted.kind !== 'elements') return { kind: 'unknown' }
  if (Array.isArray(input.impactElementIds)) {
    if (!input.impactElementIds.every((id) => typeof id === 'string' && id.trim())) return { kind: 'malformed' }
    const declared = input.impactElementIds.map((id) => id.trim())
    if (declared.length === 0) return { kind: 'missing' }
    return { kind: 'elements', ids: [...new Set([...declared, ...extracted.ids])] }
  }
  return extracted
}

export function commitmentFromUnknown(value: unknown): 'confirmed' | 'provisional' {
  return value === 'provisional' ? 'provisional' : 'confirmed'
}

export function impactForStoredPatch(patch: {
  operations?: Array<Record<string, unknown>>
  decision?: { impactElementIds?: string[]; impactUnknown?: boolean; commitment?: unknown }
}): { impact: ImpactDeclaration; commitment: 'confirmed' | 'provisional' } {
  return {
    impact: resolveProposalImpact({
      operations: patch.operations,
      impactElementIds: patch.decision?.impactElementIds,
      impactUnknown: patch.decision?.impactUnknown
    }),
    commitment: commitmentFromUnknown(patch.decision?.commitment)
  }
}

export function writePathForPatch(
  fallback: string,
  patch: { mode?: string; operations?: Array<Record<string, unknown>> }
): string {
  if (patch.mode === 'source') return 'propose_source_edit'
  if (patch.operations?.some((op) => op.op === 'refine-step')) return 'propose_refinement_step'
  return fallback
}
