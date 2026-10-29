import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PILOT_TEMPERATURE, install429Retry, localIso } from '../agent-harness/core'
import { freezeStatus, requireFreeze, type FreezeStatus } from './freeze-guard'
import { DEFAULT_MAX_APPROVALS, DRY_RUN_MAX_APPROVALS, MAX_WORKERS } from './constants'
import { installDryRunFetch } from './dry-run'
import { phasesFor, runPhase, writeExperiment } from './driver'
import { artifactsDir, finalizeSubjectLayout, subjectDir } from './layout'
import { clampConcurrency, mapPool } from './pool'
import { initSubjectProject } from './project'
import { resolveModel } from './env'
import { buildSubjectFacts } from './facts'
import { loadSubjects, resolveAssetsDir, selectSubjects } from './subjects'
import type { SessionEvent, Subject } from './types'

export type CaseStudyOptions = {
  repo: string
  out: string
  mode: 'pilot' | 'expand' | 'all' | 'ids'
  subjectIds?: string[]
  dryRun: boolean
  concurrency: number
  maxApprovals?: number
  assetsDir?: string
  /** Tests inject a freeze result. CLI uses freezeStatus(repo). */
  freeze?: FreezeStatus
  log?: (s: string) => void
  now?: () => Date
}

export type SubjectRunResult = {
  id: string
  ok: boolean
  dir: string
  error?: string
  materialsComplete?: boolean
}

export type BatchResult = {
  out: string
  dryRun: boolean
  waves: number
  ok: number
  total: number
  results: SubjectRunResult[]
  freezeTag: string
  toolchainCommit: string
  stoppedAfterWave?: number
}

async function runOneSubject(
  o: CaseStudyOptions,
  subject: Subject,
  freeze: FreezeStatus,
  model: { alias: string; modelId: string }
): Promise<SubjectRunResult> {
  const log = o.log ?? ((s: string) => console.log(s))
  const now = o.now ?? (() => new Date())
  const assetsDir = resolveAssetsDir(o.assetsDir)
  const dir = subjectDir(o.out, subject.id)
  const art = artifactsDir(o.out, subject.id)
  mkdirSync(art, { recursive: true })
  const startedAt = localIso(now())
  const events: SessionEvent[] = []
  const onEvent = (e: SessionEvent) => events.push(e)
  const maxApprovals = o.maxApprovals ?? (o.dryRun ? DRY_RUN_MAX_APPROVALS : DEFAULT_MAX_APPROVALS)
  try {
    writeExperiment(art, subject.id)
    const ctx = initSubjectProject({ artifactsRoot: art, subject, fixtureDir: assetsDir })
    const phases = phasesFor(subject)
    const phaseResults = []
    for (const phase of phases) {
      // HTTP inside one subject stays serial: phases await in order, agent-loop is single-flight.
      phaseResults.push(await runPhase({ subject, phase, projectRoot: art, ctx, maxApprovals, onEvent }))
    }
    const endedAt = localIso(now())
    const facts = buildSubjectFacts({
      subject,
      startedAt,
      endedAt,
      dryRun: o.dryRun,
      modelAlias: model.alias,
      modelId: model.modelId,
      temperature: PILOT_TEMPERATURE,
      phases: phaseResults,
      events,
      informalChars: (ctx.informalMarkdown ?? '').length,
      hybridChars: (ctx.hybridAsfl ?? '').length,
      guiChars: (ctx.guiHtml ?? '').length
    })
    const layout = finalizeSubjectLayout({
      out: o.out,
      subject,
      facts,
      events,
      toolchainCommit: freeze.head,
      toolchainTag: freeze.freezeTag
    })
    log(`${subject.id} ok materialsComplete=${layout.meta.materialsComplete}`)
    return { id: subject.id, ok: true, dir, materialsComplete: layout.meta.materialsComplete }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    log(`${subject.id} ERROR: ${msg.slice(0, 240)}`)
    writeFileSync(join(dir, 'error.json'), JSON.stringify({ id: subject.id, error: msg.slice(0, 1000), at: localIso(now()) }, null, 2))
    return { id: subject.id, ok: false, dir, error: msg }
  }
}

export async function runCaseStudyBatch(o: CaseStudyOptions): Promise<BatchResult> {
  const log = o.log ?? ((s: string) => console.log(s))
  const freeze = o.freeze ?? freezeStatus(o.repo)
  requireFreeze(freeze, o.dryRun)
  const concurrency = clampConcurrency(o.concurrency)
  if (o.concurrency > MAX_WORKERS) log(`concurrency clamped to ${MAX_WORKERS}`)
  const out = resolve(o.out)
  mkdirSync(out, { recursive: true })
  const all = loadSubjects(o.assetsDir)
  const waves = selectSubjects(all, o.mode, o.subjectIds)
  const model = resolveModel()
  if (o.dryRun) installDryRunFetch()
  install429Retry(join(out, 'retries.log'))

  const results: SubjectRunResult[] = []
  let stoppedAfterWave: number | undefined
  for (let w = 0; w < waves.length; w++) {
    const wave = waves[w]!
    log(`wave ${w + 1}/${waves.length}: ${wave.map((s) => s.id).join(', ')} (workers=${Math.min(concurrency, wave.length)})`)
    const waveResults = await mapPool(wave, concurrency, (subject) => runOneSubject(o, subject, freeze, model))
    results.push(...waveResults)
    const failed = waveResults.filter((r) => !r.ok)
    if (failed.length && w + 1 < waves.length) {
      stoppedAfterWave = w + 1
      log(`wave ${w + 1} had ${failed.length} error(s); not auto-expanding`)
      break
    }
  }
  const ok = results.filter((r) => r.ok).length
  const summary = {
    out,
    dryRun: o.dryRun,
    mode: o.mode,
    waves: waves.length,
    ok,
    total: results.length,
    concurrency,
    freezeTag: freeze.freezeTag,
    freezeCommit: freeze.freezeCommit,
    toolchainCommit: freeze.head,
    freezeCheckOk: freeze.ok,
    temperature: PILOT_TEMPERATURE,
    stoppedAfterWave,
    subjects: results
  }
  writeFileSync(join(out, 'batch.json'), JSON.stringify(summary, null, 2) + '\n')
  log(`batch done ${ok}/${results.length} ok → ${out}`)
  return {
    out,
    dryRun: o.dryRun,
    waves: waves.length,
    ok,
    total: results.length,
    results,
    freezeTag: freeze.freezeTag,
    toolchainCommit: freeze.head,
    stoppedAfterWave
  }
}
