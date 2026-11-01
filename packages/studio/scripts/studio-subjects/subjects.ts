import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Subject, TaskKind, YearsSpecWork } from './types'

export const PILOT_IDS = ['P4', 'P5', 'P6'] as const
export const SUBJECT_ID_RE = /^P([4-9]|1\d|2[0-3])$/
const YEARS = new Set<YearsSpecWork>(['lt2', '2to5', '5to10', 'gt10'])
const TASKS = new Set<TaskKind>(['greenfield', 'extension'])

export function subjectsAssetsDir(): string {
  const fromEnv = process.env.AGILE_SOFL_STUDIO_SUBJECTS_DIR
  if (fromEnv && existsSync(join(fromEnv, 'subjects.json'))) return fromEnv
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    here,
    join(here, '..', 'scripts', 'studio-subjects'),
    join(process.cwd(), 'scripts', 'studio-subjects'),
    join(process.cwd(), 'packages', 'studio', 'scripts', 'studio-subjects')
  ]
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'subjects.json'))) return candidate
  }
  throw new Error(
    'subjects.json not found. Looked next to the runner and in packages/studio/scripts/studio-subjects.'
  )
}

function asSubject(raw: Subject): Subject {
  if (!raw || typeof raw.id !== 'string' || !SUBJECT_ID_RE.test(raw.id)) {
    throw new Error(`unexpected subject id ${String(raw?.id)}`)
  }
  if (!YEARS.has(raw.yearsSpecWork)) throw new Error(`subject ${raw.id} has unknown yearsSpecWork`)
  if (!TASKS.has(raw.task)) throw new Error(`subject ${raw.id} has unknown task`)
  if (!raw.domain || !raw.project || !raw.systemName || !raw.initialModel || !raw.extension) {
    throw new Error(`subject ${raw.id} is missing required fields`)
  }
  if (!Array.isArray(raw.authorizedFacts)) raw.authorizedFacts = []
  return raw
}

export function loadSubjects(assetsDir = subjectsAssetsDir()): Subject[] {
  const raw = JSON.parse(readFileSync(join(assetsDir, 'subjects.json'), 'utf-8')) as
    | { subjects?: Subject[] }
    | Subject[]
  const list = (Array.isArray(raw) ? raw : raw.subjects ?? []).map(asSubject)
  if (list.length !== 20) throw new Error(`subjects.json must list P4–P23 (20 rows); got ${list.length}`)
  const ids = new Set(list.map((s) => s.id))
  if (ids.size !== list.length) throw new Error('subjects.json has duplicate ids')
  const missing = PILOT_IDS.filter((id) => !ids.has(id))
  if (missing.length) throw new Error(`subjects.json missing pilot ids: ${missing.join(', ')}`)
  return list
}

export function selectSubjects(all: Subject[], mode: 'pilot' | 'all' | 'ids', ids?: string[]): Subject[] {
  const byId = new Map(all.map((s) => [s.id, s]))
  const take = (want: string[]) =>
    want.map((id) => {
      const subject = byId.get(id)
      if (!subject) throw new Error(`unknown subject ${id}`)
      return subject
    })
  if (mode === 'pilot') return take([...PILOT_IDS])
  if (mode === 'ids') {
    if (!ids?.length) throw new Error('--subjects needs at least one id')
    return take(ids)
  }
  return all
}
