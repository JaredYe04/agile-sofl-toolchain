import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PILOT_IDS, SUBJECT_ID_RE } from './constants'
import type { Subject } from './types'

const here = dirname(fileURLToPath(import.meta.url))

export function resolveAssetsDir(override?: string): string {
  if (override) return override
  const candidates = [
    here,
    join(here, 'case-study-sim-assets'),
    join(process.cwd(), 'scripts', 'case-study-sim'),
    join(process.cwd(), 'packages', 'studio', 'scripts', 'case-study-sim')
  ]
  for (const c of candidates) {
    if (existsSync(join(c, 'subjects.json'))) return c
  }
  throw new Error('subjects.json not found (looked next to the runner, .harness/case-study-sim-assets, and packages/studio/scripts/case-study-sim)')
}

export function loadSubjects(assetsDir?: string): Subject[] {
  const dir = resolveAssetsDir(assetsDir)
  const raw = JSON.parse(readFileSync(join(dir, 'subjects.json'), 'utf-8')) as { subjects?: Subject[] } | Subject[]
  const list = Array.isArray(raw) ? raw : raw.subjects ?? []
  if (list.length !== 20) throw new Error(`subjects.json must list P4–P23 (20 rows); got ${list.length}`)
  const ids = list.map((s) => s.id)
  const missing = PILOT_IDS.filter((id) => !ids.includes(id))
  if (missing.length) throw new Error(`subjects.json missing pilot ids: ${missing.join(', ')}`)
  for (const s of list) {
    if (!SUBJECT_ID_RE.test(s.id)) throw new Error(`unexpected subject id ${s.id}`)
    if (!s.domain || !s.project || !s.systemName || !s.initialModel || !s.extension) {
      throw new Error(`subject ${s.id} is missing required fields`)
    }
    if (!s.authorizedFacts) s.authorizedFacts = []
  }
  return list
}

export function selectSubjects(
  all: Subject[],
  mode: 'pilot' | 'expand' | 'all' | 'ids',
  ids?: string[]
): Subject[][] {
  const byId = new Map(all.map((s) => [s.id, s]))
  const take = (want: string[]) =>
    want.map((id) => {
      const s = byId.get(id)
      if (!s) throw new Error(`unknown subject ${id}`)
      return s
    })
  const rest = all.map((s) => s.id).filter((id) => !(PILOT_IDS as readonly string[]).includes(id))
  if (mode === 'pilot') return [take([...PILOT_IDS])]
  if (mode === 'expand') return [take(rest)]
  if (mode === 'ids') {
    if (!ids?.length) throw new Error('--subjects needs at least one id')
    return [take(ids)]
  }
  return [take([...PILOT_IDS]), take(rest)]
}
