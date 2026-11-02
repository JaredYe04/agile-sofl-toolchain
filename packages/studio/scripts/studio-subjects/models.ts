import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentModel, Subject, TaskKind, ThinkingSpec, YearsSpecWork } from './types'

const BANDS: Record<
  YearsSpecWork,
  {
    acceptPropensity: number
    riskAversion: number
    proposalMedianSeconds: number
    clarificationMedianSeconds: number
    sigma: number
  }
> = {
  lt2: { acceptPropensity: 0.58, riskAversion: 0.72, proposalMedianSeconds: 16, clarificationMedianSeconds: 9, sigma: 0.42 },
  '2to5': { acceptPropensity: 0.74, riskAversion: 0.48, proposalMedianSeconds: 10, clarificationMedianSeconds: 6, sigma: 0.38 },
  '5to10': { acceptPropensity: 0.81, riskAversion: 0.36, proposalMedianSeconds: 7.5, clarificationMedianSeconds: 5, sigma: 0.34 },
  gt10: { acceptPropensity: 0.67, riskAversion: 0.64, proposalMedianSeconds: 6.5, clarificationMedianSeconds: 4.5, sigma: 0.3 }
}

const TASK_DELTA: Record<TaskKind, { acceptPropensity: number; riskAversion: number; medianSeconds: number }> = {
  greenfield: { acceptPropensity: 0, riskAversion: 0, medianSeconds: 0 },
  extension: { acceptPropensity: -0.05, riskAversion: 0.08, medianSeconds: 1.6 }
}

const PENALTIES = {
  perOp: 0.035,
  removeOp: 0.12,
  sourceEdit: 0.1,
  refineStep: 0.06,
  largePatchOps: 6,
  largePatch: 0.16
}

function hash32(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

function unit(id: string, salt: string): number {
  return hash32(`${id}:${salt}`) / 4294967296
}

function jitter(id: string, salt: string, span: number): number {
  return (unit(id, salt) - 0.5) * 2 * span
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function round(n: number, digits = 3): number {
  const p = 10 ** digits
  return Math.round(n * p) / p
}

function think(medianSeconds: number, sigma: number, minSeconds: number, maxSeconds: number, secondsPerKChar: number): ThinkingSpec {
  return {
    distribution: 'lognormal',
    medianSeconds: round(medianSeconds, 2),
    sigma: round(sigma, 2),
    secondsPerKChar,
    minSeconds,
    maxSeconds
  }
}

/** Derive one subject model from the task-packet row. No per-id conditionals. */
export function generateAgentModel(subject: Subject): AgentModel {
  const band = BANDS[subject.yearsSpecWork]
  const task = TASK_DELTA[subject.task]
  if (!band || !task) throw new Error(`subject ${subject.id} has no model band for ${subject.yearsSpecWork}/${subject.task}`)
  const acceptPropensity = round(
    clamp(band.acceptPropensity + task.acceptPropensity + jitter(subject.id, 'accept', 0.035), 0.42, 0.9)
  )
  const riskAversion = round(clamp(band.riskAversion + task.riskAversion + jitter(subject.id, 'risk', 0.04), 0.2, 0.9))
  const proposalMedian = band.proposalMedianSeconds + task.medianSeconds + jitter(subject.id, 'median', 1.1)
  const clarificationMedian = band.clarificationMedianSeconds + task.medianSeconds * 0.45 + jitter(subject.id, 'clar', 0.6)
  return {
    id: subject.id,
    version: 1,
    interpreter: 'studio-subject-policy-v1',
    source: 'subject-table',
    derivedFrom: {
      yearsSpecWork: subject.yearsSpecWork,
      task: subject.task,
      domain: subject.domain
    },
    acceptPropensity,
    riskAversion,
    penalties: { ...PENALTIES },
    clarification: 'authorized-facts',
    proposalThink: think(proposalMedian, band.sigma, 3, 55, 1.5),
    clarificationThink: think(clarificationMedian, band.sigma * 0.9, 2, 24, 0.3),
    seed: hash32(subject.id),
    notes:
      'Derived from yearsSpecWork and task. The interpreter reads these fields and does not special-case the subject id.'
  }
}

export function generateAgentModels(subjects: Subject[]): AgentModel[] {
  return subjects.map(generateAgentModel)
}

export function modelPath(assetsDir: string, id: string): string {
  return join(assetsDir, 'models', `${id}.json`)
}

export function writeAgentModels(assetsDir: string, subjects: Subject[]): AgentModel[] {
  const dir = join(assetsDir, 'models')
  mkdirSync(dir, { recursive: true })
  const models = generateAgentModels(subjects)
  for (const model of models) {
    writeFileSync(join(dir, `${model.id}.json`), `${JSON.stringify(model, null, 2)}\n`)
  }
  return models
}

export function assertAgentModel(raw: AgentModel, id: string): AgentModel {
  if (raw.id !== id) throw new Error(`model file ${id}.json has id ${raw.id}`)
  if (raw.version !== 1 || raw.interpreter !== 'studio-subject-policy-v1') {
    throw new Error(`model ${id} has an unsupported interpreter`)
  }
  if (raw.clarification !== 'authorized-facts') throw new Error(`model ${id} must answer clarifications from authorized facts`)
  if (!(raw.acceptPropensity >= 0 && raw.acceptPropensity <= 1)) throw new Error(`model ${id} acceptPropensity out of range`)
  if (!(raw.riskAversion >= 0 && raw.riskAversion <= 1)) throw new Error(`model ${id} riskAversion out of range`)
  if (raw.proposalThink.minSeconds < 3) throw new Error(`model ${id} proposal thinking minimum must be at least 3 seconds`)
  if (raw.clarificationThink.minSeconds < 2) throw new Error(`model ${id} clarification thinking minimum must be at least 2 seconds`)
  if (raw.proposalThink.distribution !== 'lognormal' || raw.clarificationThink.distribution !== 'lognormal') {
    throw new Error(`model ${id} thinking distribution must be lognormal`)
  }
  return raw
}

export function loadAgentModel(assetsDir: string, id: string): AgentModel {
  const file = modelPath(assetsDir, id)
  if (!existsSync(file)) throw new Error(`missing agent model ${file}. Run with --generate-models`)
  return assertAgentModel(JSON.parse(readFileSync(file, 'utf-8')) as AgentModel, id)
}

export function loadAgentModels(assetsDir: string, subjects: Subject[]): Map<string, AgentModel> {
  const out = new Map<string, AgentModel>()
  for (const subject of subjects) out.set(subject.id, loadAgentModel(assetsDir, subject.id))
  return out
}
