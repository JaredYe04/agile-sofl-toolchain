/**
 * Experiment batch runner: T, B2 (headless agent, real LLM) and B0-auto (rule-based generator, no LLM).
 *
 *   node scripts/agent-harness/build.mjs
 *   node .harness/batch.mjs [--systems classroom,delivery] [--conditions T,B2,B0-auto] [--repeats 5]
 *        [--max-approvals 8] [--out <dir>] [--key-file <path outside --out>] [--env-file <.env>] [--dry-run]
 *   (run from packages/studio of the checkout/worktree to use)
 *
 * - Strictly serial; HTTP 429/503 retried with exponential backoff (retries.log).
 * - Refuses to run (exit 2) unless the tool source equals exp-freeze-v1.2 and the workspace dists are
 *   fresh (see freeze.ts); use prepare-v12.mjs to build a v1.2 worktree. --dry-run reports but continues.
 * - Runs are executed in a random interleaved order; run ids are random hex. The id -> (system, condition,
 *   repeat, order) key goes ONLY to --key-file, which must be outside --out. Coders get out/blinded/<id>.asfl.
 *   (out/runs/<id>/ keeps telemetry, which names the condition: do not hand runs/ to coders.)
 * - Every manifest records toolCommit, freeze tag/commit, freeze check result and the harness sha256.
 * - LLM runs of one system must share one prompt hash, otherwise the batch aborts.
 * - --dry-run: no LLM/network calls at all (fetch is replaced by a local fake), no API key needed.
 * - Never prints the API key (stdout/stderr are redacted).
 */
import { randomBytes, randomInt } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { install429Retry, runOnce } from './core'
import { runB0Auto } from './b0auto'
import { freezeStatus, harnessSha, isInside, FREEZE_TAG } from './freeze'
import { getEnvLlmFallback } from '../../src/main/services/llm/env'
import { diagnosticCounts, getExperimentConfig } from '../../src/main/services/llm/experiment'

export const SYSTEMS: Record<string, string> = {
  classroom: 'packages/parser/tests/fixtures/reference-systems/classroom.aspec',
  delivery: 'packages/parser/tests/fixtures/reference-systems/delivery-trimmed.aspec'
}
export type Condition = 'T' | 'B2' | 'B0-auto'

export interface BatchOptions {
  repo: string
  systems: string[]
  conditions: Condition[]
  repeats: number
  maxApprovals: number
  out: string
  keyFile: string
  dryRun: boolean
  harnessDir: string
  log?: (s: string) => void
}

function sse(chunks: unknown[]): Response {
  const body = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n'
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}
/** Local fake for --dry-run: first call of a turn proposes a tiny module, the follow-up stops. No network. */
export function installDryRunFetch(): void {
  globalThis.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { messages?: Array<{ role: string }> }
    const last = body.messages?.at(-1)?.role
    const usage = { model: 'dry-run', choices: [], usage: { prompt_tokens: 0, completion_tokens: 0 } }
    if (last === 'tool') return sse([{ model: 'dry-run', choices: [{ delta: { content: 'dry-run done' }, finish_reason: 'stop' }] }, usage])
    return sse([
      { model: 'dry-run', choices: [{ delta: { tool_calls: [{ index: 0, id: `dry-${randomBytes(3).toString('hex')}`, function: { name: 'propose_hybrid_changes', arguments: JSON.stringify({ explanation: 'dry run', operations: [{ op: 'add', kind: 'module', name: 'SYSTEM_DryRun' }] }) } }] } }] },
      { model: 'dry-run', choices: [{ delta: {}, finish_reason: 'tool_calls' }] }, usage
    ])
  }) as typeof fetch
}

export async function runBatch(o: BatchOptions) {
  const log = o.log ?? ((s: string) => console.log(s))
  const out = resolve(o.out), keyFile = resolve(o.keyFile)
  if (isInside(keyFile, out)) throw new Error(`--key-file must be outside --out (${keyFile} is inside ${out})`)
  for (const s of o.systems) if (!SYSTEMS[s]) throw new Error(`unknown system '${s}' (known: ${Object.keys(SYSTEMS).join(', ')})`)
  const fz = freezeStatus(o.repo)
  if (!fz.ok) {
    const msg = `freeze check FAILED: ${fz.reasons.join('; ')}${fz.changedToolFiles.length ? `\n  e.g. ${fz.changedToolFiles.slice(0, 8).join('\n  ')}` : ''}`
    if (!o.dryRun) throw Object.assign(new Error(msg + `\nRun on ${FREEZE_TAG} (see prepare-v12.mjs) or use --dry-run.`), { exitCode: 2 })
    log(`[dry-run] ${msg} (continuing because --dry-run)`)
  }
  mkdirSync(out, { recursive: true })
  mkdirSync(dirname(keyFile), { recursive: true })
  if (existsSync(keyFile)) throw new Error(`key file already exists: ${keyFile}`)
  const batchId = randomBytes(4).toString('hex')
  const hsha = harnessSha(o.harnessDir)
  const provenance = { batchId, toolCommit: fz.head, freezeTag: fz.freezeTag, freezeCommit: fz.freezeCommit, freezeCheckOk: fz.ok, harnessSha256: hsha, dryRun: o.dryRun }

  if (o.dryRun) installDryRunFetch()
  else install429Retry(join(out, 'retries.log'))

  // schedule: every (system, condition, repeat), random interleaved order
  const schedule = o.systems.flatMap((system) => o.conditions.flatMap((condition) => Array.from({ length: o.repeats }, (_, k) => ({ system, condition, repeat: k + 1 }))))
  for (let i = schedule.length - 1; i > 0; i--) { const j = randomInt(i + 1); [schedule[i], schedule[j]] = [schedule[j]!, schedule[i]!] }
  const used = new Set<string>()
  const newId = () => { let id; do id = randomBytes(4).toString('hex'); while (used.has(id)); used.add(id); return id }

  const key = { ...provenance, createdAt: new Date().toISOString(), out, runs: [] as Array<Record<string, unknown>> }
  const saveKey = () => writeFileSync(keyFile, JSON.stringify(key, null, 2))
  saveKey()
  writeFileSync(join(out, 'batch.json'), JSON.stringify({ ...provenance, startedAt: key.createdAt, totalRuns: schedule.length, systems: o.systems, conditions: o.conditions, repeats: o.repeats, maxApprovals: o.maxApprovals, keyFile: '(kept outside the outputs)' }, null, 2))
  mkdirSync(join(out, 'blinded'), { recursive: true })
  const evalCfg = getExperimentConfig(undefined, { AGILE_SOFL_CONDITION: 'T', AGILE_SOFL_TELEMETRY: '0' })
  const hashBySystem = new Map<string, string>()
  let consecutiveErrors = 0
  for (const [order, item] of schedule.entries()) {
    const runId = newId()
    const informalPath = join(o.repo, SYSTEMS[item.system]!)
    const entry: Record<string, unknown> = { runId, order: order + 1, ...item, startedAt: new Date().toISOString() }
    key.runs.push(entry); saveKey()
    try {
      let runDir: string
      if (item.condition === 'B0-auto') {
        runDir = runB0Auto({ informalPath, outDir: out, runId, manifestExtra: provenance }).runDir
      } else {
        const r = await runOnce({ condition: item.condition, informalPath, outDir: out, maxApprovals: o.maxApprovals, runId, manifestExtra: provenance })
        runDir = r.runDir
        entry.promptHash = r.promptHash; entry.approvals = r.approvals; entry.stopReason = r.stopReason
        const prev = hashBySystem.get(item.system)
        if (prev && prev !== r.promptHash) throw Object.assign(new Error(`prompt hash mismatch for ${item.system}: ${prev} vs ${r.promptHash}`), { fatal: true })
        hashBySystem.set(item.system, r.promptHash)
      }
      const hybrid = readFileSync(join(runDir, 'hybrid.asfl'), 'utf-8')
      writeFileSync(join(runDir, 'final-diagnostics.json'), JSON.stringify({ evaluationOnly: 'full checker (parser+L1+L2) on the final hybrid, independent of condition', ...(await diagnosticCounts(hybrid, evalCfg)) }, null, 2))
      writeFileSync(join(out, 'blinded', `${runId}.asfl`), hybrid)
      entry.status = 'ok'; entry.finishedAt = new Date().toISOString()
      consecutiveErrors = 0
      log(`[${order + 1}/${schedule.length}] run ${runId} ok`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      entry.status = 'error'; entry.error = msg.slice(0, 300); entry.finishedAt = new Date().toISOString()
      saveKey()
      log(`[${order + 1}/${schedule.length}] run ${runId} ERROR: ${msg.slice(0, 200)}`)
      if ((e as { fatal?: boolean }).fatal || ++consecutiveErrors >= 3) throw new Error(`batch aborted after run ${runId}: ${msg.slice(0, 200)}`)
    }
    saveKey()
  }
  const done = key.runs.filter((r) => r.status === 'ok').length
  writeFileSync(join(out, 'batch.json'), JSON.stringify({ ...JSON.parse(readFileSync(join(out, 'batch.json'), 'utf-8')), finishedAt: new Date().toISOString(), okRuns: done }, null, 2))
  return { batchId, out, keyFile, total: schedule.length, ok: done, provenance }
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
  const dryRun = process.argv.includes('--dry-run')
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
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const out = resolve(arg('out', join(repo, 'packages', 'studio', '.harness', `batch-${stamp}${dryRun ? '-dry' : ''}`))!)
  const keyFile = resolve(arg('key-file', join(repo, '..', 'agile-sofl-batch-keys', `batch-${stamp}${dryRun ? '-dry' : ''}.key.json`))!)
  const r = await runBatch({
    repo,
    systems: arg('systems', 'classroom,delivery')!.split(','),
    conditions: arg('conditions', 'T,B2,B0-auto')!.split(',') as Condition[],
    repeats: Number(arg('repeats', '5')),
    maxApprovals: Number(arg('max-approvals', '8')),
    out, keyFile, dryRun,
    harnessDir: join(repo, 'packages', 'studio', 'scripts', 'agent-harness')
  })
  console.log(JSON.stringify({ batchId: r.batchId, out: r.out, keyFile: r.keyFile, total: r.total, ok: r.ok, toolCommit: r.provenance.toolCommit, freezeCheckOk: r.provenance.freezeCheckOk, dryRun }))
}

if (process.argv[1] && /batch\.(mjs|ts)$/.test(process.argv[1])) {
  main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit((e as { exitCode?: number }).exitCode ?? 1) })
}
