/**
 * Experiment batch runner: T, B2 (headless agent, real LLM) and B0-auto (rule-based generator, no LLM).
 *
 *   node scripts/agent-harness/build.mjs
 *   node .harness/batch.mjs [--systems classroom,delivery] [--conditions T,B2,B0-auto] [--repeats 5]
 *        [--max-approvals 8] [--seed <n>] [--stop-at HH:MM] [--out <dir>] [--key-file <path outside --out>]
 *        [--env-file <.env>] [--dry-run [--dry-run-delay-ms <ms>]]
 *   node .harness/batch.mjs --resume <keyFile> [--stop-at HH:MM]
 *   (run from packages/studio of the checkout/worktree to use)
 *
 * - Strictly serial; HTTP 429/503 retried with exponential backoff; every retry/give-up is logged to
 *   out/retries.log with local time, run id, run order and attempt (never the condition).
 * - Schedule: block-randomised (one block per repeat, each block = every system x condition pair once, permuted
 *   by a seeded mulberry32 PRNG; --seed, default random and printed). Seed, design and the full schedule
 *   (order -> system/condition/repeat/runId) are stored ONLY in the key file.
 * - --stop-at HH:MM (local): no new run is started at/after the next occurrence of HH:MM after the session
 *   start; the batch stops cleanly (status interrupted, interruptedAt, nextOrder, reason in key file + batch.json).
 * - --resume <keyFile>: continues the same schedule from the next unfinished order into the same out dir after
 *   re-verifying the freeze check, tool commit, harness sha256, informal inputs and prompt hashes against the
 *   first session. Sessions (start/end, runs done) and the per-run session index are kept in the key file only.
 *   A run cut off mid-way (or the error streak that aborted a session) is moved to out/aborted/<id>-a<n>/
 *   (logged in out/aborted/aborted.log) and rerun from scratch.
 * - Refuses to run (exit 2) unless the tool source equals exp-freeze-v1.2 and the workspace dists are
 *   fresh (see freeze.ts); use prepare-v12.mjs to build a v1.2 worktree. --dry-run reports but continues.
 * - Run ids are random hex. The id -> (system, condition,
 *   repeat, order) key goes ONLY to --key-file, which must be outside --out. Coders get out/blinded/<id>/
 *   (final.asfl + steps/<n>.asfl).
 *   (out/runs/<id>/ keeps telemetry, which names the condition: do not hand runs/ to coders.)
 * - After every approved step the spec is snapshotted (runs/<id>/steps/<n>.asfl, blinded/<id>/steps/<n>.asfl)
 *   and checked by the full checker (parser+L1+L2) -> runs/<id>/steps.jsonl + steps.csv; batch.json gets a
 *   pooled per-step aggregate, the key file a per system/condition one. B0-auto has one snapshot.
 * - Every manifest records maxApprovals, toolCommit, freeze tag/commit, freeze check result and the harness sha256.
 * - LLM runs of one system must have the prompt hash computed at batch creation, otherwise the batch aborts.
 * - --dry-run: no LLM/network calls at all (fetch is replaced by a local fake), no API key needed.
 * - Never prints the API key (stdout/stderr are redacted).
 */
import { randomBytes, randomInt } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { expectedPromptHash, install429Retry, localIso, runOnce, setRetryContext } from './core'
import { readInformal } from './informal'
import { blockDesign, blockSchedule, parseSeed, stopDate, type ScheduleItem } from './schedule'
import { runB0Auto } from './b0auto'
import { freezeStatus, harnessSha, isInside, FREEZE_TAG } from './freeze'
import { aggregateSteps, recordStep, type StepRecord } from './steps'
import { getEnvLlmFallback } from '../../src/main/services/llm/env'
import { diagnosticCounts, getExperimentConfig } from '../../src/main/services/llm/experiment'

export const SYSTEMS: Record<string, string> = {
  classroom: 'packages/parser/tests/fixtures/reference-systems/classroom.aspec',
  delivery: 'packages/parser/tests/fixtures/reference-systems/delivery-trimmed.aspec'
}
export type Condition = 'T' | 'B2' | 'B0-auto'

function sse(chunks: unknown[]): Response {
  const body = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n'
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}
/** Local fake for --dry-run: proposes a tiny module per call (up to DRY_RUN_PROPOSALS per run), then stops. No network. */
export const DRY_RUN_PROPOSALS = 3
export function installDryRunFetch(delayMs = 0): void {
  globalThis.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs)) // --dry-run-delay-ms: simulate LLM latency
    const body = JSON.parse(String(init?.body ?? '{}')) as { messages?: Array<{ role: string }> }
    const toolResults = body.messages?.filter((m) => m.role === 'tool').length ?? 0
    const usage = { model: 'dry-run', choices: [], usage: { prompt_tokens: 0, completion_tokens: 0 } }
    if (toolResults >= DRY_RUN_PROPOSALS) return sse([{ model: 'dry-run', choices: [{ delta: { content: 'dry-run done' }, finish_reason: 'stop' }] }, usage])
    return sse([
      { model: 'dry-run', choices: [{ delta: { tool_calls: [{ index: 0, id: `dry-${randomBytes(3).toString('hex')}`, function: { name: 'propose_hybrid_changes', arguments: JSON.stringify({ explanation: 'dry run', operations: [{ op: 'add', kind: 'module', name: `SYSTEM_DryRun${toolResults + 1}` }] }) } }] } }] },
      { model: 'dry-run', choices: [{ delta: {}, finish_reason: 'tool_calls' }] }, usage
    ])
  }) as typeof fetch
}

export interface BatchOptions {
  repo: string
  /** new batch: the design; on --resume these are taken from the key file */
  systems?: string[]
  conditions?: Condition[]
  repeats?: number
  maxApprovals?: number
  out?: string
  keyFile: string
  dryRun: boolean
  harnessDir: string
  /** PRNG seed for the block-randomised schedule (new batch; default: random) */
  seed?: number
  /** HH:MM local: don't start a new run at/after this time (next occurrence after the session start) */
  stopAt?: string
  /** continue the batch recorded in keyFile */
  resume?: boolean
  /** dry run only: fake LLM latency per call (to exercise --stop-at in a real-time dry run) */
  dryRunDelayMs?: number
  log?: (s: string) => void
  /** test hooks */
  now?: () => Date
  afterRun?: (order: number) => void
}

type RunEntry = Record<string, unknown> & { order: number; runId: string; system: string; condition: string; status?: string }
interface Session { session: number; startedAt: string; endedAt?: string; startOrder: number; nextOrder?: number; runsDone: number; runsOk: number; stopAt?: string; endReason?: string; toolCommit: string; freezeCheckOk: boolean }
interface KeyFile {
  batchId: string; toolCommit: string; freezeTag: string; freezeCommit: string | null; freezeCheckOk: boolean; harnessSha256: string; dryRun: boolean; maxApprovals: number
  createdAt: string; out: string; systems: string[]; conditions: Condition[]; repeats: number
  seed: number; design: ReturnType<typeof blockDesign>
  schedule: Array<ScheduleItem & { runId: string }>
  promptHashes: Record<string, string>; informalSha256: Record<string, string>
  runs: RunEntry[]; sessions: Session[]; interruptions: Array<Record<string, unknown>>
  status: 'running' | 'interrupted' | 'aborted' | 'finished'; nextOrder: number; interruptedAt?: string; stopReason?: string
  stepSummaryByGroup?: Record<string, unknown>
}

const refuse = (msg: string) => Object.assign(new Error(msg), { exitCode: 2 })

export async function runBatch(o: BatchOptions) {
  const log = o.log ?? ((s: string) => console.log(s))
  const now = o.now ?? (() => new Date())
  const keyFile = resolve(o.keyFile)
  const fz = freezeStatus(o.repo)
  const hsha = harnessSha(o.harnessDir)
  let key: KeyFile

  if (o.resume) {
    if (!existsSync(keyFile)) throw new Error(`--resume: key file not found: ${keyFile}`)
    key = JSON.parse(readFileSync(keyFile, 'utf-8')) as KeyFile
    if (!key.schedule || !key.sessions) throw new Error(`--resume: ${keyFile} is not a resumable batch key file`)
    if (key.status === 'finished') throw new Error(`--resume: batch ${key.batchId} is already finished`)
    if (key.dryRun !== o.dryRun) throw refuse(`--resume: the batch was ${key.dryRun ? '' : 'not '}a dry run; resume it the same way`)
    if (!existsSync(key.out)) throw new Error(`--resume: output dir missing: ${key.out}`)
    // same tool, same harness, same inputs as the first session
    const problems: string[] = []
    if (!fz.ok) problems.push(`freeze check failed: ${fz.reasons.join('; ')}`)
    if (fz.freezeCommit !== key.freezeCommit) problems.push(`freeze commit ${fz.freezeCommit} != ${key.freezeCommit}`)
    if (fz.head !== key.toolCommit) problems.push(`tool commit ${fz.head} != ${key.toolCommit}`)
    if (hsha !== key.harnessSha256) problems.push(`harness sha256 ${hsha.slice(0, 12)}... != first session ${key.harnessSha256.slice(0, 12)}...`)
    for (const s of key.systems) {
      const p = join(o.repo, SYSTEMS[s]!)
      if (readInformal(p).sha256 !== key.informalSha256[s]) problems.push(`informal input of ${s} changed`)
      if (expectedPromptHash(p) !== key.promptHashes[s]) problems.push(`prompt hash of ${s} changed`)
    }
    const fatal = problems.filter((p) => !(o.dryRun && /^freeze check failed/.test(p)))
    if (fatal.length) throw refuse(`--resume refused:\n  ${fatal.join('\n  ')}`)
    if (problems.length > fatal.length) log(`[dry-run] ${problems[0]} (continuing because --dry-run)`)
  } else {
    const systems = o.systems ?? ['classroom', 'delivery'], conditions = o.conditions ?? ['T', 'B2', 'B0-auto']
    const repeats = o.repeats ?? 5, maxApprovals = o.maxApprovals ?? 8
    if (!o.out) throw new Error('out dir required')
    const out = resolve(o.out)
    if (isInside(keyFile, out)) throw new Error(`--key-file must be outside --out (${keyFile} is inside ${out})`)
    for (const s of systems) if (!SYSTEMS[s]) throw new Error(`unknown system '${s}' (known: ${Object.keys(SYSTEMS).join(', ')})`)
    if (!fz.ok) {
      const msg = `freeze check FAILED: ${fz.reasons.join('; ')}${fz.changedToolFiles.length ? `\n  e.g. ${fz.changedToolFiles.slice(0, 8).join('\n  ')}` : ''}`
      if (!o.dryRun) throw refuse(msg + `\nRun on ${FREEZE_TAG} (see prepare-v12.mjs) or use --dry-run.`)
      log(`[dry-run] ${msg} (continuing because --dry-run)`)
    }
    if (existsSync(keyFile)) throw new Error(`key file already exists: ${keyFile}`)
    if (existsSync(join(out, 'batch.json'))) throw new Error(`output dir already holds a batch: ${out} (use --resume <keyFile>)`)
    const seed = o.seed ?? randomInt(0, 2 ** 31)
    const used = new Set<string>()
    const newId = () => { let id; do id = randomBytes(4).toString('hex'); while (used.has(id)); used.add(id); return id }
    const schedule = blockSchedule(systems, conditions, repeats, seed).map((x) => ({ ...x, runId: newId() }))
    key = {
      batchId: randomBytes(4).toString('hex'), toolCommit: fz.head, freezeTag: fz.freezeTag, freezeCommit: fz.freezeCommit, freezeCheckOk: fz.ok,
      harnessSha256: hsha, dryRun: o.dryRun, maxApprovals, createdAt: localIso(now()), out, systems, conditions, repeats,
      seed, design: blockDesign(systems, conditions, repeats, seed), schedule,
      promptHashes: Object.fromEntries(systems.map((s) => [s, expectedPromptHash(join(o.repo, SYSTEMS[s]!))])),
      informalSha256: Object.fromEntries(systems.map((s) => [s, readInformal(join(o.repo, SYSTEMS[s]!)).sha256])),
      runs: [], sessions: [], interruptions: [], status: 'running', nextOrder: 1
    }
    mkdirSync(out, { recursive: true })
  }
  const out = key.out
  mkdirSync(dirname(keyFile), { recursive: true })
  mkdirSync(join(out, 'blinded'), { recursive: true })
  const provenance = { batchId: key.batchId, toolCommit: key.toolCommit, freezeTag: key.freezeTag, freezeCommit: key.freezeCommit, freezeCheckOk: fz.ok, harnessSha256: key.harnessSha256, dryRun: key.dryRun, maxApprovals: key.maxApprovals }
  const saveKey = () => writeFileSync(keyFile, JSON.stringify(key, null, 2))
  const total = key.schedule.length
  // batch.json: blind-safe (no seed, schedule, conditions per run or session index)
  const writeBatchJson = (extra: Record<string, unknown> = {}) => {
    const prev = existsSync(join(out, 'batch.json')) ? JSON.parse(readFileSync(join(out, 'batch.json'), 'utf-8')) : {}
    const ok = key.runs.filter((r) => r.status === 'ok').length
    writeFileSync(join(out, 'batch.json'), JSON.stringify({
      ...prev, ...provenance, freezeCheckOk: key.freezeCheckOk, startedAt: key.createdAt, totalRuns: total, systems: key.systems, conditions: key.conditions, repeats: key.repeats,
      design: 'block-randomised (seed and schedule are in the key file only)', keyFile: '(kept outside the outputs)',
      status: key.status, runsDone: ok, okRuns: ok, nextOrder: key.nextOrder, sessions: key.sessions.length,
      interruptedAt: key.status === 'interrupted' ? key.interruptedAt : undefined, stopReason: key.stopReason,
      interruptions: key.interruptions.map((x) => ({ at: x.at, nextOrder: x.nextOrder, runsDone: x.runsDone, reason: x.reason })),
      ...extra
    }, null, 2))
  }

  const sessionStart = now()
  const stop = o.stopAt ? stopDate(o.stopAt, sessionStart) : undefined
  const session: Session = { session: key.sessions.length + 1, startedAt: localIso(sessionStart), startOrder: key.nextOrder, runsDone: 0, runsOk: 0, stopAt: stop ? localIso(stop) : undefined, toolCommit: fz.head, freezeCheckOk: fz.ok }
  key.sessions.push(session)
  key.status = 'running'; delete key.interruptedAt; delete key.stopReason
  saveKey(); writeBatchJson()
  log(`batch ${key.batchId}: session ${session.session}, orders ${key.nextOrder}..${total}${stop ? `, stop at ${localIso(stop)}` : ''}`)

  if (key.dryRun) installDryRunFetch(o.dryRunDelayMs ?? 0)
  install429Retry(join(out, 'retries.log'))
  let current: { runId?: string; order?: number } = {}
  setRetryContext(() => ({ run: current.runId, order: current.order }))

  const evalCfg = getExperimentConfig(undefined, { AGILE_SOFL_CONDITION: 'T', AGILE_SOFL_TELEMETRY: '0' })
  const counts = (asfl: string) => diagnosticCounts(asfl, evalCfg)
  const abortedLog = (line: string) => { mkdirSync(join(out, 'aborted'), { recursive: true }); appendFileSync(join(out, 'aborted', 'aborted.log'), `${localIso(now())} ${line}\n`) }
  let consecutiveErrors = 0, streakStart = 0
  const endSession = (status: KeyFile['status'], reason: string) => {
    key.status = status
    session.endedAt = localIso(now()); session.nextOrder = key.nextOrder; session.endReason = reason
    if (status === 'interrupted' || status === 'aborted') {
      key.interruptedAt = session.endedAt; key.stopReason = reason
      key.interruptions.push({ at: session.endedAt, session: session.session, nextOrder: key.nextOrder, runsDone: key.runs.filter((r) => r.status === 'ok').length, reason })
    }
    // per-step aggregates from disk (covers all sessions)
    const okRuns = key.runs.filter((r) => r.status === 'ok')
    const stepsOf = (r: RunEntry) => { const f = join(out, 'runs', r.runId, 'steps.jsonl'); return existsSync(f) ? readFileSync(f, 'utf-8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as StepRecord) : [] }
    const groups = new Map<string, StepRecord[][]>()
    for (const r of okRuns) { const g = `${r.system}/${r.condition}`; groups.set(g, [...(groups.get(g) ?? []), stepsOf(r)]) }
    key.stepSummaryByGroup = Object.fromEntries([...groups].map(([g, rs]) => [g, aggregateSteps(rs)]))
    saveKey()
    writeBatchJson({ finishedAt: status === 'finished' ? session.endedAt : undefined,
      stepSummaryNote: 'per approved step n, over ok runs that reached n, all conditions pooled (full checker on runs/<id>/steps/<n>.asfl; per-condition breakdown is in the key file)',
      stepSummary: aggregateSteps(okRuns.map(stepsOf)) })
    log(`session ${session.session} ${status}: ${reason}; ${key.runs.filter((r) => r.status === 'ok').length}/${total} runs ok, next order ${key.nextOrder}`)
  }

  for (let order = key.nextOrder; order <= total; order++) {
    if (stop && now().getTime() >= stop.getTime()) { endSession('interrupted', `stop-at ${o.stopAt} reached`); return result() }
    const item = key.schedule[order - 1]!
    const runId = item.runId
    const prevIdx = key.runs.findIndex((r) => r.order === order)
    const prev = prevIdx >= 0 ? key.runs[prevIdx]! : undefined
    if (prev?.status === 'ok') { key.nextOrder = order + 1; continue }
    let attempt = 1
    const previousAttempts: unknown[] = []
    if (prev) {
      // cut off mid-run (status 'running') or errored before an abort: move the partial run aside, rerun from scratch
      attempt = Number(prev.attempt ?? 1) + 1
      const dst = join(out, 'aborted', `${runId}-a${attempt - 1}`)
      mkdirSync(dst, { recursive: true })
      const moved: string[] = []
      for (const [src, name] of [[join(out, 'runs', runId), 'run'], [join(out, 'blinded', runId), 'blinded']] as const) {
        if (existsSync(src)) { renameSync(src, join(dst, name)); moved.push(name) }
      }
      const why = prev.status === 'running' ? 'cut off mid-run' : `errored (${String(prev.error ?? '').slice(0, 80)})`
      abortedLog(`run=${runId} order=${order} attempt=${attempt - 1} ${why}; moved ${moved.join('+') || 'nothing'} to aborted/${runId}-a${attempt - 1}; rerun from scratch`)
      log(`[${order}/${total}] run ${runId}: previous attempt ${why} -> aborted/${runId}-a${attempt - 1}, rerunning`)
      previousAttempts.push(...((prev.previousAttempts as unknown[]) ?? []), { ...prev, previousAttempts: undefined, movedTo: `aborted/${runId}-a${attempt - 1}` })
    }
    const entry: RunEntry = { order, runId, system: item.system, condition: item.condition, repeat: item.repeat, block: item.block, session: session.session, attempt, status: 'running', startedAt: localIso(now()) }
    if (previousAttempts.length) entry.previousAttempts = previousAttempts
    if (prevIdx >= 0) key.runs[prevIdx] = entry; else key.runs.push(entry)
    key.nextOrder = order // if the process dies now, resume reruns this order
    current = { runId, order }
    saveKey()
    const informalPath = join(o.repo, SYSTEMS[item.system]!)
    const blindedDir = join(out, 'blinded', runId)
    const steps: StepRecord[] = []
    try {
      let runDir: string
      if (item.condition === 'B0-auto') {
        runDir = runB0Auto({ informalPath, outDir: out, runId, manifestExtra: provenance }).runDir
        steps.push(await recordStep({ runDir, blindedDir, counts }, { step: 1, hybrid: readFileSync(join(runDir, 'hybrid.asfl'), 'utf-8'), tool: 'b0-auto-generator', applied: true }))
      } else {
        const r = await runOnce({
          condition: item.condition as 'T' | 'B2', informalPath, outDir: out, maxApprovals: key.maxApprovals, runId, manifestExtra: provenance,
          onStep: async (s) => { steps.push(await recordStep({ runDir: s.runDir, blindedDir, counts }, s)) }
        })
        runDir = r.runDir
        entry.promptHash = r.promptHash; entry.approvals = r.approvals; entry.stopReason = r.stopReason
        if (r.promptHash !== key.promptHashes[item.system]) throw Object.assign(new Error(`prompt hash mismatch for ${item.system}: ${key.promptHashes[item.system]} vs ${r.promptHash}`), { fatal: true })
      }
      const hybrid = readFileSync(join(runDir, 'hybrid.asfl'), 'utf-8')
      writeFileSync(join(runDir, 'final-diagnostics.json'), JSON.stringify({ evaluationOnly: 'full checker (parser+L1+L2) on the final hybrid, independent of condition', ...(await diagnosticCounts(hybrid, evalCfg)) }, null, 2))
      mkdirSync(blindedDir, { recursive: true })
      writeFileSync(join(blindedDir, 'final.asfl'), hybrid)
      entry.steps = steps.length
      entry.status = 'ok'; entry.finishedAt = localIso(now())
      consecutiveErrors = 0
      session.runsOk++
      log(`[${order}/${total}] run ${runId} ok`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      entry.status = 'error'; entry.error = msg.slice(0, 300); entry.finishedAt = localIso(now())
      log(`[${order}/${total}] run ${runId} ERROR: ${msg.slice(0, 200)}`)
      if (consecutiveErrors++ === 0) streakStart = order
      if ((e as { fatal?: boolean }).fatal || consecutiveErrors >= 3) {
        session.runsDone++
        key.nextOrder = (e as { fatal?: boolean }).fatal ? order : streakStart // resume reruns the failed streak
        endSession('aborted', `aborted after run ${runId}: ${msg.slice(0, 200)}`)
        throw new Error(`batch aborted after run ${runId}: ${msg.slice(0, 200)} (resume with --resume ${keyFile})`)
      }
    } finally { current = {} }
    session.runsDone++
    key.nextOrder = order + 1
    saveKey()
    o.afterRun?.(order)
  }
  endSession('finished', 'all scheduled runs done')
  return result()

  function result() {
    const ok = key.runs.filter((r) => r.status === 'ok').length
    return { batchId: key.batchId, out, keyFile, total, ok, seed: key.seed, status: key.status, nextOrder: key.nextOrder, session: session.session, provenance }
  }
}

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : def
}

/** Load KEY=VALUE lines into process.env (not overriding). The key is read in place, never copied or printed. */
export function loadEnvFile(path: string): boolean {
  if (!existsSync(path)) return false
  for (const line of readFileSync(path, 'utf-8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const k = t.slice(0, t.indexOf('=')).trim()
    let v = t.slice(t.indexOf('=') + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (k && !process.env[k]) process.env[k] = v
  }
  return true
}

async function main() {
  const repo = execFileSync('git', ['-c', 'safe.directory=*', 'rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim()
  const resumeFile = arg('resume')
  let dryRun = process.argv.includes('--dry-run')
  if (resumeFile) {
    if (!existsSync(resumeFile)) throw new Error(`--resume: key file not found: ${resolve(resumeFile)}`)
    const k = JSON.parse(readFileSync(resumeFile, 'utf-8')) as { dryRun?: boolean }
    if (dryRun && !k.dryRun) throw Object.assign(new Error('--resume: that batch is a real batch; resume it without --dry-run'), { exitCode: 2 })
    dryRun = !!k.dryRun // a dry batch always resumes as a dry run
    const ignored = ['systems', 'conditions', 'repeats', 'max-approvals', 'out', 'key-file', 'seed'].filter((n) => process.argv.includes(`--${n}`))
    if (ignored.length) console.log(`--resume: ignoring ${ignored.map((n) => `--${n}`).join(', ')} (taken from the key file)`)
  }
  // In a v1.2 worktree made by prepare-v12.mjs, the .env (API key) stays in the original checkout:
  // --env-file or .harness/v12-origin.json points at it.
  const origin = join(repo, 'packages', 'studio', '.harness', 'v12-origin.json')
  const envFile = arg('env-file') ?? (existsSync(origin) ? JSON.parse(readFileSync(origin, 'utf-8')).envFile : undefined)
  if (envFile && !dryRun) loadEnvFile(resolve(envFile))
  const userData = process.env.AGILE_SOFL_HARNESS_USERDATA || join(repo, 'packages', 'studio', '.harness', 'userdata')
  process.env.AGILE_SOFL_HARNESS_USERDATA = userData
  mkdirSync(userData, { recursive: true })
  // empty profile store -> the studio falls back to packages/studio/.env and never persists the key
  writeFileSync(join(userData, 'llm-profiles.json'), JSON.stringify({ activeId: null, profiles: [] }))
  if (!dryRun) {
    const fz = freezeStatus(repo) // refuse before touching the API key
    if (!fz.ok) throw Object.assign(new Error(`freeze check FAILED: ${fz.reasons.join('; ')}\nRun on ${FREEZE_TAG} (node scripts/agent-harness/prepare-v12.mjs) or use --dry-run.`), { exitCode: 2 })
  }
  let key = ''
  if (!dryRun) {
    key = getEnvLlmFallback().apiKey
    if (!key) throw new Error('ECNU_API_KEY missing in packages/studio/.env')
  } else if (!process.env.ECNU_API_KEY) process.env.ECNU_API_KEY = 'dry-run-placeholder'
  for (const stream of [process.stdout, process.stderr]) {
    const w = stream.write.bind(stream)
    stream.write = ((chunk: unknown, ...rest: unknown[]) => w(typeof chunk === 'string' && key ? chunk.split(key).join('[redacted]') : chunk, ...(rest as []))) as typeof stream.write
  }
  const stopAt = arg('stop-at')
  const dryRunDelayMs = Number(arg('dry-run-delay-ms', '0'))
  if (stopAt) stopDate(stopAt, new Date()) // validate early
  const harnessDir = join(repo, 'packages', 'studio', 'scripts', 'agent-harness')
  let r
  if (resumeFile) {
    r = await runBatch({ repo, keyFile: resumeFile, resume: true, dryRun, harnessDir, stopAt, dryRunDelayMs })
  } else {
    const stamp = localIso().slice(0, 19).replace(/[:.]/g, '-') // local time
    const out = resolve(arg('out', join(repo, 'packages', 'studio', '.harness', `batch-${stamp}${dryRun ? '-dry' : ''}`))!)
    const keyFile = resolve(arg('key-file', join(repo, '..', 'agile-sofl-batch-keys', `batch-${stamp}${dryRun ? '-dry' : ''}.key.json`))!)
    const seedArg = arg('seed')
    const seed = seedArg !== undefined ? parseSeed(seedArg) : randomInt(0, 2 ** 31)
    console.log(`seed: ${seed}${seedArg === undefined ? ' (generated)' : ''}`)
    r = await runBatch({
      repo,
      systems: arg('systems', 'classroom,delivery')!.split(','),
      conditions: arg('conditions', 'T,B2,B0-auto')!.split(',') as Condition[],
      repeats: Number(arg('repeats', '5')),
      maxApprovals: Number(arg('max-approvals', '8')),
      out, keyFile, dryRun, seed, stopAt, harnessDir, dryRunDelayMs
    })
  }
  console.log(JSON.stringify({ batchId: r.batchId, out: r.out, keyFile: r.keyFile, status: r.status, session: r.session, total: r.total, ok: r.ok, nextOrder: r.nextOrder, toolCommit: r.provenance.toolCommit, freezeCheckOk: r.provenance.freezeCheckOk, dryRun }))
  if (r.status === 'interrupted') console.log(`resume with:  node .harness/batch.mjs --resume "${r.keyFile}"`)
}

if (process.argv[1] && /batch\.(mjs|ts)$/.test(process.argv[1])) {
  main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit((e as { exitCode?: number }).exitCode ?? 1) })
}
