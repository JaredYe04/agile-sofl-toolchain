/**
 * k=10 ablation: same renewal task as k10, but ask_clarification is removed and proposals auto-apply.
 * Measures whether the Agent silently commits a cutoff boundary without asking.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { runOnce, install429Retry, setRetryContext, localIso } from './core'

function arg(name: string, def?: string) {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 ? process.argv[i + 1] : def
}

function applyHarnessEnvExtras() {
  if (process.env.ECNU_TLS_INSECURE === '1' || process.env.ECNU_TLS_INSECURE === 'true') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  }
}

function loadEnv(p: string) {
  if (!existsSync(p)) throw new Error('env file not found: ' + p)
  for (const line of readFileSync(p, 'utf-8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const i = t.indexOf('=')
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'"))) v = v.slice(1, -1)
    if (k.startsWith('ECNU_')) process.env[k] = v
    else if (k && (process.env[k] == null || process.env[k] === '')) process.env[k] = v
  }
  applyHarnessEnvExtras()
}

/** Classify inclusive vs exclusive cutoff at zero days remaining, if present in RenewLoan FSF text. */
function classifyCutoff(hybrid: string): 'inclusive' | 'exclusive' | 'unclear' | 'none' {
  const chunk = hybrid.slice(0, 12000)
  const renew = /RenewLoan|Renew/i.test(chunk) ? chunk : hybrid
  if (!/days_remaining|daysRemaining|due/i.test(renew)) return 'none'
  if (/days_remaining\s*>\s*0|daysRemaining\s*>\s*0|>\s*0/.test(renew)) return 'exclusive'
  if (/days_remaining\s*>=\s*0|daysRemaining\s*>=\s*0|>=\s*0/.test(renew)) return 'inclusive'
  if (/>\s*0/.test(renew)) return 'exclusive'
  return 'unclear'
}

async function main() {
  const envFile = resolve(arg('env', '') || '')
  if (!envFile) throw new Error('--env <.env.ecnu> required')
  loadEnv(envFile)
  const key = (process.env.ECNU_API_KEY || '').trim()
  if (!key) throw new Error('ECNU_API_KEY missing in the provided env file')
  for (const s of [process.stdout, process.stderr]) {
    const w = s.write.bind(s)
    s.write = ((c, ...r) => w(typeof c === 'string' ? c.split(key).join('[redacted]') : c, ...r)) as typeof s.write
  }
  const k = Number(arg('k', '10'))
  const informal = resolve(arg('informal', '') || '')
  if (!informal || !existsSync(informal)) throw new Error('--informal <file.aspec> required')
  const maxApprovals = Number(arg('max-approvals', '8'))
  const out = resolve(arg('out', '.harness/k10-ablation-' + Date.now()))
  mkdirSync(out, { recursive: true })
  install429Retry(join(out, 'retries.log'))

  const userText =
    'Generate the Hybrid Specification from the Informal Specification. Strategy: rebuild. ' +
    'Work incrementally with the tools. Do not ask the analyst questions; commit concrete behavior in the hybrid source.'

  const summaryPath = join(out, 'k10-ablation.json')
  const meta = existsSync(summaryPath)
    ? (JSON.parse(readFileSync(summaryPath, 'utf-8')) as {
        probe: string
        startedAt: string
        envModel: string
        informal: string
        k: number
        maxApprovals: number
        omitAskClarification: boolean
        temperature: number
        runs: Record<string, unknown>[]
      })
    : {
        probe: 'k10-ablation-no-clarify',
        startedAt: localIso(),
        envModel: process.env.ECNU_MODEL || 'ecnu-max',
        informal,
        k,
        maxApprovals,
        omitAskClarification: true,
        temperature: 0.35,
        runs: [] as Record<string, unknown>[]
      }
  if (!existsSync(summaryPath)) writeFileSync(summaryPath, JSON.stringify(meta, null, 2))

  const doneRuns = new Set(
    meta.runs.map((r) => Number((r as { run?: number }).run)).filter((n) => Number.isFinite(n))
  )

  let order = meta.runs.length
  for (let i = 0; i < k; i++) {
    if (doneRuns.has(i + 1)) {
      console.log(JSON.stringify({ run: i + 1, skipped: true, reason: 'already in k10-ablation.json' }))
      continue
    }
    order++
    setRetryContext(() => ({ run: i + 1, order }))
    const events: Record<string, unknown>[] = []
    const t0 = Date.now()
    let res
    try {
      res = await runOnce({
        condition: 'T',
        informalPath: informal,
        outDir: out,
        maxApprovals,
        omitAskClarification: true,
        userText,
        onStudyEvent: (e) => events.push(e),
        runId: 'k10a-' + String(i + 1).padStart(2, '0'),
        manifestExtra: { probe: 'k10-ablation-no-clarify', envModel: meta.envModel }
      })
    } catch (e) {
      const rec = { run: i + 1, error: String(e && (e as Error).message || e).slice(0, 200), ms: Date.now() - t0 }
      meta.runs.push(rec)
      console.log(JSON.stringify(rec))
      writeFileSync(summaryPath, JSON.stringify(meta, null, 2))
      continue
    }
    const asks = events.filter((e) => e.type === 'clarification_asked')
    const props = events.filter((e) => e.type === 'proposal')
    const firstAppliedIdx = events.findIndex((e) => e.type === 'proposal' && (e as { applied?: boolean }).applied)
    let hybridText = ''
    try {
      hybridText = readFileSync(join(res.runDir, 'hybrid.asfl'), 'utf-8')
    } catch {
      /* none */
    }
    const cutoff = classifyCutoff(hybridText)
    const rec = {
      run: i + 1,
      approvals: res.approvals,
      stopReason: res.stopReason,
      clarifications: asks.length,
      proposalTurns: props.length,
      proposalsApplied: props.filter((p) => (p as { applied?: boolean }).applied).length,
      askedBeforeFirstAppliedWrite: asks.length > 0 && firstAppliedIdx >= 0 && events.findIndex((e) => e.type === 'clarification_asked') < firstAppliedIdx,
      firstWriteWithoutClarify: asks.length === 0 && firstAppliedIdx >= 0,
      cutoffBoundary: cutoff,
      hybridNonEmpty: hybridText.trim().length > 0,
      hybridChars: hybridText.length,
      ms: Date.now() - t0
    }
    meta.runs.push(rec)
    console.log(JSON.stringify(rec))
    writeFileSync(summaryPath, JSON.stringify(meta, null, 2))
  }

  const ok = meta.runs.filter((r) => !(r as { error?: string }).error)
  const runIds = new Set(ok.map((r) => Number((r as { run?: number }).run)).filter((n) => Number.isFinite(n)))
  const haveAll = [...Array(k)].every((_, j) => runIds.has(j + 1))
  if (haveAll) {
    const cutoffCounts: Record<string, number> = {}
    for (const r of ok.filter((r) => (r as { run?: number }).run != null && (r as { run: number }).run <= k)) {
      const c = String((r as { cutoffBoundary?: string }).cutoffBoundary || 'unclear')
      cutoffCounts[c] = (cutoffCounts[c] || 0) + 1
    }
    meta.aggregate = {
      runsOk: ok.length,
      clarifications: ok.map((r) => Number((r as { clarifications?: number }).clarifications ?? 0)),
      firstWriteWithoutClarify:
        ok.filter((r) => (r as { firstWriteWithoutClarify?: boolean }).firstWriteWithoutClarify).length + '/' + ok.length,
      cutoffBoundaryCounts: cutoffCounts
    }
    ;(meta as { endedAt?: string }).endedAt = localIso()
    writeFileSync(summaryPath, JSON.stringify(meta, null, 2))
    console.log('AGGREGATE ' + JSON.stringify(meta.aggregate))
  } else {
    writeFileSync(summaryPath, JSON.stringify(meta, null, 2))
    console.log('INCOMPLETE ' + ok.length + '/' + k + ' runs; re-run with same --out to resume')
  }
}

main().catch((e) => {
  console.error(e && (e as Error).message || e)
  process.exit(1)
})
