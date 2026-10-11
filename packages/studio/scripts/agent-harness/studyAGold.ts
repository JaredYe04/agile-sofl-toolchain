/**
 * Study A gold-package loader.
 * DEV files in this scaffold are not a confirmatory freeze set.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { GoldPackage, GoldSlot } from './studyAGoldTypes'

export type { GoldPackage, GoldSlot, GoldAlternative, GoldMaintenance, CommitmentSignal } from './studyAGoldTypes'
export { GOLD_SCHEMA_VERSION } from './studyAGoldTypes'

const KINDS = new Set(['underspecified', 'clear-control', 'maintenance'])

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringList(value: unknown, path: string, errors: string[]): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    errors.push(`${path} must be an array of non-empty strings`)
    return []
  }
  return value.map((item) => item.trim())
}

function checkSlot(raw: unknown, index: number, errors: string[]): GoldSlot | null {
  const path = `unresolvedSlots[${index}]`
  if (!isObject(raw)) {
    errors.push(`${path} must be an object`)
    return null
  }
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  const question = typeof raw.question === 'string' ? raw.question.trim() : ''
  const clarificationTarget = typeof raw.clarificationTarget === 'string' ? raw.clarificationTarget.trim() : ''
  const stakeholderAnswer = typeof raw.stakeholderAnswer === 'string' ? raw.stakeholderAnswer.trim() : ''
  if (!id) errors.push(`${path}.id is required`)
  if (!question) errors.push(`${path}.question is required`)
  if (!clarificationTarget) errors.push(`${path}.clarificationTarget is required`)
  if (!stakeholderAnswer) errors.push(`${path}.stakeholderAnswer is required`)
  if (!Array.isArray(raw.alternatives) || raw.alternatives.length < 2) {
    errors.push(`${path}.alternatives needs at least two business interpretations`)
  }
  const alternatives = Array.isArray(raw.alternatives)
    ? raw.alternatives.flatMap((alt) => {
        if (!isObject(alt) || typeof alt.id !== 'string' || typeof alt.label !== 'string') return []
        const altId = alt.id.trim()
        const label = alt.label.trim()
        if (!altId || !label) return []
        return [{ id: altId, label }]
      })
    : []
  if (Array.isArray(raw.alternatives) && alternatives.length !== raw.alternatives.length) {
    errors.push(`${path}.alternatives entries need id and label`)
  }
  const ids = new Set(alternatives.map((alt) => alt.id))
  if (ids.size !== alternatives.length) errors.push(`${path}.alternatives ids must be unique`)
  const authorizedAlternativeId = typeof raw.authorizedAlternativeId === 'string' ? raw.authorizedAlternativeId.trim() : ''
  if (!ids.has(authorizedAlternativeId)) errors.push(`${path}.authorizedAlternativeId must name one alternative`)
  const authorized = alternatives.find((alt) => alt.id === authorizedAlternativeId)
  if (authorized && stakeholderAnswer !== authorized.label) {
    errors.push(`${path}.stakeholderAnswer must be exactly the authorized alternative label`)
  }
  for (const alt of alternatives) {
    if (alt.id !== authorizedAlternativeId && stakeholderAnswer.includes(alt.label)) {
      errors.push(`${path}.stakeholderAnswer must not repeat a non-authorized alternative`)
    }
  }
  const matchTerms = stringList(raw.matchTerms, `${path}.matchTerms`, errors)
  if (matchTerms.length === 0) errors.push(`${path}.matchTerms must be non-empty`)
  for (const term of matchTerms) {
    if (term.length < 4) errors.push(`${path}.matchTerms entries must be at least 4 characters`)
  }
  const mustNotConfirmBeforeAnswer = stringList(raw.mustNotConfirmBeforeAnswer, `${path}.mustNotConfirmBeforeAnswer`, errors)
  if (!Array.isArray(raw.commitmentSignals)) {
    errors.push(`${path}.commitmentSignals is required`)
  }
  const commitmentSignals = Array.isArray(raw.commitmentSignals)
    ? raw.commitmentSignals.flatMap((row) => {
        if (!isObject(row) || typeof row.alternativeId !== 'string') return []
        const phrases = Array.isArray(row.phrases) ? row.phrases.filter((p): p is string => typeof p === 'string' && p.trim().length >= 4).map((p) => p.trim()) : []
        return [{ alternativeId: row.alternativeId.trim(), phrases }]
      })
    : []
  const signaled = new Set(commitmentSignals.map((row) => row.alternativeId))
  for (const alt of alternatives) {
    const row = commitmentSignals.find((item) => item.alternativeId === alt.id)
    if (!row || row.phrases.length === 0) errors.push(`${path}.commitmentSignals missing phrases for ${alt.id}`)
  }
  if (signaled.size !== commitmentSignals.length) errors.push(`${path}.commitmentSignals alternative ids must be unique`)
  return {
    id,
    question,
    alternatives,
    authorizedAlternativeId,
    clarificationTarget,
    mustNotConfirmBeforeAnswer,
    stakeholderAnswer,
    matchTerms,
    commitmentSignals
  }
}

export function validateGold(raw: unknown): { ok: true; gold: GoldPackage } | { ok: false; errors: string[] } {
  const errors: string[] = []
  if (!isObject(raw)) return { ok: false, errors: ['gold package must be a JSON object'] }
  const allowed = new Set([
    'schemaVersion', 'scenarioId', 'partition', 'devExample', 'confirmatory', 'title', 'domain', 'kind',
    'clearControl', 'naturalLanguageRequirements', 'informalMarkdown', 'unresolvedSlots', 'maintenance', 'qualityNotes'
  ])
  for (const key of Object.keys(raw)) if (!allowed.has(key)) errors.push(`unknown field ${key}`)
  if (raw.schemaVersion !== 'study-a-gold-1') errors.push('schemaVersion must be study-a-gold-1')
  const scenarioId = typeof raw.scenarioId === 'string' ? raw.scenarioId.trim() : ''
  if (!scenarioId) errors.push('scenarioId is required')
  if (raw.partition !== 'dev' && raw.partition !== 'held-out') errors.push('partition must be dev or held-out')
  if (typeof raw.devExample !== 'boolean') errors.push('devExample must be boolean')
  if (raw.confirmatory !== false) errors.push('confirmatory must be false; this scaffold is not a confirmatory freeze set')
  if (raw.partition === 'dev' && raw.devExample !== true) errors.push('dev partition requires devExample true')
  if (raw.partition === 'held-out' && raw.devExample !== false) errors.push('held-out partition requires devExample false')
  if (typeof raw.title !== 'string' || !raw.title.trim()) errors.push('title is required')
  if (typeof raw.domain !== 'string' || !raw.domain.trim()) errors.push('domain is required')
  if (typeof raw.kind !== 'string' || !KINDS.has(raw.kind)) errors.push('kind must be underspecified, clear-control, or maintenance')
  if (typeof raw.clearControl !== 'boolean') errors.push('clearControl must be boolean')
  if (raw.kind === 'clear-control' && raw.clearControl !== true) errors.push('clear-control kind requires clearControl true')
  if (raw.kind !== 'clear-control' && raw.clearControl !== false) errors.push('clearControl is only true for clear-control scenarios')
  if (typeof raw.naturalLanguageRequirements !== 'string' || !raw.naturalLanguageRequirements.trim()) {
    errors.push('naturalLanguageRequirements is required')
  }
  if (typeof raw.informalMarkdown !== 'string' || !raw.informalMarkdown.includes('# Functions')) {
    errors.push('informalMarkdown must include the Functions section')
  }
  if (typeof raw.qualityNotes !== 'string') errors.push('qualityNotes is required')
  if (!Array.isArray(raw.unresolvedSlots)) errors.push('unresolvedSlots must be an array')
  const unresolvedSlots = Array.isArray(raw.unresolvedSlots)
    ? raw.unresolvedSlots.map((slot, i) => checkSlot(slot, i, errors)).filter((slot): slot is GoldSlot => Boolean(slot))
    : []
  const slotIds = new Set(unresolvedSlots.map((slot) => slot.id))
  if (slotIds.size !== unresolvedSlots.length) errors.push('unresolved slot ids must be unique')
  if (raw.clearControl === true && unresolvedSlots.length !== 0) errors.push('a clear control has no unresolved slots')
  if (raw.clearControl === false && unresolvedSlots.length === 0) errors.push('a non-control scenario needs at least one unresolved slot')
  let maintenance: GoldPackage['maintenance'] = null
  if (raw.kind === 'maintenance') {
    if (!isObject(raw.maintenance)) errors.push('maintenance scenarios require a maintenance object')
    else {
      const changeRequest = typeof raw.maintenance.changeRequest === 'string' ? raw.maintenance.changeRequest.trim() : ''
      if (!changeRequest) errors.push('maintenance.changeRequest is required')
      const affectedElementIds = stringList(raw.maintenance.affectedElementIds, 'maintenance.affectedElementIds', errors)
      const unaffectedElementIds = stringList(raw.maintenance.unaffectedElementIds, 'maintenance.unaffectedElementIds', errors)
      const overlap = affectedElementIds.filter((id) => unaffectedElementIds.includes(id))
      if (overlap.length) errors.push(`maintenance impact sets overlap: ${overlap.join(', ')}`)
      maintenance = { changeRequest, affectedElementIds, unaffectedElementIds }
    }
  } else if (raw.maintenance !== null) {
    errors.push('maintenance must be null unless kind is maintenance')
  }
  if (errors.length || !scenarioId || (raw.partition !== 'dev' && raw.partition !== 'held-out') || typeof raw.kind !== 'string') {
    return { ok: false, errors }
  }
  const gold: GoldPackage = {
    schemaVersion: 'study-a-gold-1',
    scenarioId,
    partition: raw.partition,
    devExample: raw.devExample === true,
    confirmatory: false,
    title: String(raw.title).trim(),
    domain: String(raw.domain).trim(),
    kind: raw.kind as GoldPackage['kind'],
    clearControl: raw.clearControl === true,
    naturalLanguageRequirements: String(raw.naturalLanguageRequirements).trim(),
    informalMarkdown: String(raw.informalMarkdown).replace(/\r\n?/g, '\n'),
    unresolvedSlots,
    maintenance,
    qualityNotes: String(raw.qualityNotes)
  }
  return errors.length ? { ok: false, errors } : { ok: true, gold }
}

export function loadGold(path: string): GoldPackage {
  const text = readFileSync(path, 'utf-8').replace(/^\uFEFF/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error(`gold package ${path} is not JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
  const result = validateGold(parsed)
  if (!result.ok) throw new Error(`gold package ${path} is invalid:\n  ${result.errors.join('\n  ')}`)
  return result.gold
}

export function goldFileSha256(path: string): string {
  const text = readFileSync(path, 'utf-8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  return createHash('sha256').update(text).digest('hex')
}
