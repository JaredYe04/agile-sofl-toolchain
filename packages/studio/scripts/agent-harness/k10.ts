/**
 * Fresh k-repeat clarification/authoring reliability probe for the paper (2026-10-25).
 * NOT the archived v3 comparison: new task (library-informal.aspec), new out dir, fixed oracle,
 * model = ecnu-max (gateway routes to deepseek-v4-flash, the participants' model). Isolated from v3.
 *
 * Run (from packages/studio):
 *   node scripts/agent-harness/build-k10.mjs        # bundle k10.mjs
 *   node .harness/k10.mjs --env .env.lab --k 10 --informal <library.aspec> --out <dir> [--max-approvals N]
 *
 * Per run reports: asked-before-first-applied-write, #clarifications, #proposal-turns(approvals),
 * final hybrid non-empty + parse status. Never prints the API key.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { runOnce, install429Retry, setRetryContext, localIso } from './core'

function arg(name, def) {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 ? process.argv[i + 1] : def
}

// Fixed oracle: every clarification gets the same deterministic answer. This isolates
// AGENT-side behavior (does it ask, how many asks, how many proposals) across repeats.
const FIXED_ORACLE =
  'Keep the informal specification exactly as given; do not introduce new business rules, ' +
  'thresholds, roles, or limits beyond what is stated. Derive the hybrid specification faithfully ' +
  'from the Functions, Data Resources, and Constraints already present.'

function applyHarnessEnvExtras() {
  if (process.env.ECNU_TLS_INSECURE === '1' || process.env.ECNU_TLS_INSECURE === 'true') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  }
}

function loadEnv(p) {
  // The provided env file is authoritative for ECNU_* (the toolchain repo's own
  // packages/studio/.env would otherwise win and may pin a model with no runtime).
  if (!existsSync(p)) throw new Error('env file not found: ' + p)
  for (const line of readFileSync(p, 'utf-8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const i = t.indexOf('='); const k = t.slice(0, i).trim(); let v = t.slice(i + 1).trim()
    if ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'"))) v = v.slice(1, -1)
    if (k.startsWith('ECNU_')) process.env[k] = v      // force-override ECNU_*
    else if (k && (process.env[k] == null || process.env[k] === '')) process.env[k] = v
  }
  applyHarnessEnvExtras()
}

async function main() {
  const envFile = resolve(arg('env', '') || '')
  if (!envFile) throw new Error('--env <.env.ecnu> required')
  loadEnv(envFile)
  const key = (process.env.ECNU_API_KEY || '').trim()
  if (!key) throw new Error('ECNU_API_KEY missing in the provided env file')
  for (const s of [process.stdout, process.stderr]) {
    const w = s.write.bind(s)
    s.write = ((c, ...r) => w(typeof c === 'string' ? c.split(key).join('[redacted]') : c, ...r))
  }
  const k = Number(arg('k', '10'))
  const informal = resolve(arg('informal', '') || '')
  if (!informal || !existsSync(informal)) throw new Error('--informal <file.aspec> required')
  const maxApprovals = Number(arg('max-approvals', '6'))
  const out = resolve(arg('out', '.harness/k10-' + Date.now()))
  mkdirSync(out, { recursive: true })
  install429Retry(join(out, 'retries.log'))

  const meta = { startedAt: localIso(), envModel: process.env.ECNU_MODEL || 'ecnu-max',
    baseUrl: process.env.ECNU_API_BASE_URL || 'chat.ecnu.edu.cn', informal, k, maxApprovals,
    fixedOracle: FIXED_ORACLE, temperature: 0.35, runs: [] }
  writeFileSync(join(out, 'k10.json'), JSON.stringify(meta, null, 2))

  let order = 0
  for (let i = 0; i < k; i++) {
    order++
    setRetryContext(() => ({ run: i + 1, order }))
    const events = []
    const t0 = Date.now()
    let res
    try {
      res = await runOnce({
        condition: 'T', informalPath: informal, outDir: out, maxApprovals,
        userText: 'Generate the Hybrid Specification from the Informal Specification. ' +
          'Strategy: rebuild (no existing Hybrid). Work incrementally with the tools. ' +
          'Ask the analyst only when a stated requirement is genuinely ambiguous.',
        resolveClarification: () => ({ text: FIXED_ORACLE, matchedSlotIds: ['fixed-oracle'] }),
        onStudyEvent: (e) => events.push(e),
        runId: 'k10-' + String(i + 1).padStart(2, '0'),
        manifestExtra: { probe: 'k10-reliability', envModel: meta.envModel }
      })
    } catch (e) {
      const rec = { run: i + 1, error: String(e && e.message || e).slice(0, 200), ms: Date.now() - t0 }
      meta.runs.push(rec); console.log(JSON.stringify(rec)); writeFileSync(join(out, 'k10.json'), JSON.stringify(meta, null, 2)); continue
    }
    const asks = events.filter(e => e.type === 'clarification_asked')
    const props = events.filter(e => e.type === 'proposal')
    const firstProposalIdx = events.findIndex(e => e.type === 'proposal')
    const firstAskIdx = events.findIndex(e => e.type === 'clarification_asked')
    const firstAppliedIdx = events.findIndex(e => e.type === 'proposal' && e.applied)
    const askedBeforeFirstAppliedWrite = firstAppliedIdx < 0
      ? (asks.length > 0) : (firstAskIdx >= 0 && firstAskIdx < firstAppliedIdx)
    let hybridText = ''
    try { hybridText = readFileSync(join(res.runDir, 'hybrid.asfl'), 'utf-8') } catch { /* none */ }
    const rec = {
      run: i + 1, approvals: res.approvals, stopReason: res.stopReason,
      clarifications: asks.length, proposalTurns: props.length,
      proposalsApplied: props.filter(p => p.applied).length,
      askedBeforeFirstAppliedWrite,
      hybridNonEmpty: hybridText.trim().length > 0,
      hybridChars: hybridText.length,
      promptHash: res.promptHash.slice(0, 12), ms: Date.now() - t0
    }
    meta.runs.push(rec); console.log(JSON.stringify(rec))
    writeFileSync(join(out, 'k10.json'), JSON.stringify(meta, null, 2))
  }

  // aggregate
  const ok = meta.runs.filter(r => !r.error)
  const agg = {
    runsOk: ok.length, runsErrored: meta.runs.length - ok.length,
    askedBeforeFirstAppliedWrite: ok.filter(r => r.askedBeforeFirstAppliedWrite).length + '/' + ok.length,
    clarifications: range(ok.map(r => r.clarifications)),
    proposalTurns: range(ok.map(r => r.proposalTurns)),
    proposalsApplied: range(ok.map(r => r.proposalsApplied)),
    hybridNonEmpty: ok.filter(r => r.hybridNonEmpty).length + '/' + ok.length,
  }
  meta.aggregate = agg; meta.endedAt = localIso()
  writeFileSync(join(out, 'k10.json'), JSON.stringify(meta, null, 2))
  console.log('AGGREGATE ' + JSON.stringify(agg))
}
function range(a) { if (!a.length) return null; const s = [...a].sort((x, y) => x - y)
  return { min: s[0], max: s[s.length - 1], mean: +(a.reduce((p, c) => p + c, 0) / a.length).toFixed(2) } }

main().catch(e => { console.error(e && e.message || e); process.exit(1) })
