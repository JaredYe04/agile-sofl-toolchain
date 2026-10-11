import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { authorNotesFromInformalMarkdown, type AuthorTextNote } from '@agile-sofl/parser'
import {
  applyRefinementStep,
  buildRefinementState,
  parseRefinementLog,
  serializeRefinementLog,
  type RefinementLogEntry,
  type RefinementStep
} from '@agile-sofl/editor-api'
import { acceptHybridWrite } from '../../shared/asflRepair'
import { guardProjectWrite } from '../../shared/dasr/projectGate'

function informalGrainNotes(projectRoot: string): AuthorTextNote[] {
  if (!projectRoot) return []
  let names: string[] = []
  try {
    names = readdirSync(projectRoot).filter((name) => name.endsWith('.aspec'))
  } catch {
    return []
  }
  const notes: AuthorTextNote[] = []
  for (const name of names) {
    try {
      notes.push(...authorNotesFromInformalMarkdown(readFileSync(join(projectRoot, name), 'utf-8')))
    } catch {
      /* skip unreadable informal files */
    }
  }
  return notes
}

export function refinementLogPath(projectRoot: string): string {
  return join(projectRoot, '.agile-sofl', 'refinement-log.jsonl')
}

export function readRefinementLog(projectRoot: string): RefinementLogEntry[] {
  const file = refinementLogPath(projectRoot)
  if (!existsSync(file)) return []
  try {
    return parseRefinementLog(readFileSync(file, 'utf-8'))
  } catch {
    return []
  }
}

export function writeRefinementLog(projectRoot: string, entries: RefinementLogEntry[]): void {
  const file = refinementLogPath(projectRoot)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, serializeRefinementLog(entries), 'utf-8')
}

export function applyProjectRefinementStep(
  projectRoot: string,
  source: string,
  step: RefinementStep
): ReturnType<typeof applyRefinementStep> & { repairNotes?: string[] } {
  const log = readRefinementLog(projectRoot)
  const result = applyRefinementStep(source, log, step, informalGrainNotes(projectRoot))
  if (result.error) return result
  const moduleName = typeof step.moduleName === 'string' ? step.moduleName : ''
  const processName = typeof step.processName === 'string' ? step.processName : ''
  const typeName = typeof step.typeName === 'string' ? step.typeName : ''
  const impact = moduleName && processName
    ? { kind: 'elements' as const, ids: [`proc:${moduleName}.${processName}`] }
    : moduleName && typeName
      ? { kind: 'elements' as const, ids: [`type:${moduleName}.${typeName}`] }
      : { kind: 'unknown' as const }
  // dasr-gate:propose_refinement_step
  const decision = guardProjectWrite(projectRoot, {
    writePath: 'propose_refinement_step',
    impact,
    commitment: 'confirmed'
  })
  if (!decision.allow) return { ...result, source, log, error: decision.error }
  const gated = acceptHybridWrite(source, result.source)
  if (!gated.ok) return { ...result, source, log, error: gated.error }
  writeRefinementLog(projectRoot, result.log)
  return { ...result, source: gated.content, repairNotes: gated.repairNotes }
}

export function projectRefinementState(projectRoot: string, source: string) {
  return buildRefinementState(source, readRefinementLog(projectRoot), informalGrainNotes(projectRoot))
}
