#!/usr/bin/env node
/**
 * Summarise .agile-sofl/llm-calls.jsonl telemetry.
 *   node scripts/analyze-llm-calls.mjs <llm-calls.jsonl>... [--by condition|participantId|sessionId] [--csv]
 * Outputs per group: LLM calls, tokens, latency, proposal approval rate (all / refinement steps,
 * also per step type), and post-write diagnostic counts per layer (parser / L1 / L2, error / warning):
 * mean over writes and the last value per session.
 */
import { readFileSync } from 'node:fs'

export function analyze(records, by = 'condition') {
  const groups = new Map()
  const g = (key) => {
    if (!groups.has(key)) groups.set(key, {
      group: key, llmCalls: 0, llmErrors: 0, promptTokens: 0, completionTokens: 0, latencyMs: [],
      proposals: { approved: 0, rejected: 0, error: 0 }, refine: { approved: 0, rejected: 0, error: 0 }, byStep: {},
      writes: [], lastBySession: new Map()
    })
    return groups.get(key)
  }
  for (const r of records) {
    const x = g(String(r[by] ?? 'unknown'))
    if (r.event === 'llm_call') {
      x.llmCalls++
      if (!r.ok) x.llmErrors++
      x.promptTokens += r.promptTokens ?? 0
      x.completionTokens += r.completionTokens ?? 0
      if (typeof r.latencyMs === 'number') x.latencyMs.push(r.latencyMs)
    } else if (r.event === 'proposal_decision') {
      x.proposals[r.decision] = (x.proposals[r.decision] ?? 0) + 1
      if (r.tool === 'propose_refinement_step') {
        x.refine[r.decision] = (x.refine[r.decision] ?? 0) + 1
        const s = (x.byStep[r.stepType || '?'] ??= { approved: 0, rejected: 0, error: 0 })
        s[r.decision] = (s[r.decision] ?? 0) + 1
      }
    } else if (r.event === 'post_write_diagnostics') {
      x.writes.push(r.diagnostics)
      x.lastBySession.set(r.sessionId, r.diagnostics)
    }
  }
  const rate = (c) => { const n = c.approved + c.rejected + c.error; return n ? +(c.approved / n).toFixed(4) : null }
  const mean = (a) => (a.length ? +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(3) : null)
  const layerMeans = (list) => {
    const out = {}
    for (const layer of ['parser', 'l1', 'l2']) for (const sev of ['error', 'warning']) {
      out[`${layer}_${sev}`] = mean(list.map((d) => d?.[layer]?.[sev] ?? 0))
    }
    return out
  }
  return [...groups.values()].map((x) => ({
    group: x.group,
    llmCalls: x.llmCalls,
    llmErrors: x.llmErrors,
    promptTokens: x.promptTokens,
    completionTokens: x.completionTokens,
    meanLatencyMs: mean(x.latencyMs),
    proposals: { ...x.proposals, approvalRate: rate(x.proposals) },
    refinementSteps: { ...x.refine, approvalRate: rate(x.refine) },
    refinementByStepType: Object.fromEntries(Object.entries(x.byStep).map(([k, v]) => [k, { ...v, approvalRate: rate(v) }])),
    postWrite: { writes: x.writes.length, mean: layerMeans(x.writes), lastPerSessionMean: layerMeans([...x.lastBySession.values()]) }
  }))
}

export function readJsonl(paths) {
  const out = []
  for (const p of paths) for (const line of readFileSync(p, 'utf-8').split(/\r?\n/)) {
    if (!line.trim()) continue
    try { out.push(JSON.parse(line)) } catch { /* skip bad line */ }
  }
  return out
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href
if (isMain) {
  const args = process.argv.slice(2)
  const byIdx = args.indexOf('--by')
  const by = byIdx >= 0 ? args[byIdx + 1] : 'condition'
  const csv = args.includes('--csv')
  const files = args.filter((a, i) => !a.startsWith('--') && (byIdx < 0 || i !== byIdx + 1))
  if (!files.length) { console.error('usage: analyze-llm-calls.mjs <file.jsonl>... [--by condition|participantId|sessionId] [--csv]'); process.exit(1) }
  const res = analyze(readJsonl(files), by)
  if (!csv) console.log(JSON.stringify(res, null, 2))
  else {
    const cols = ['group', 'llmCalls', 'promptTokens', 'completionTokens', 'meanLatencyMs', 'proposalApprovalRate', 'refineApprovalRate', 'writes',
      ...['parser', 'l1', 'l2'].flatMap((l) => [`${l}_error`, `${l}_warning`]).map((c) => `last_${c}`)]
    console.log(cols.join(','))
    for (const r of res) console.log([r.group, r.llmCalls, r.promptTokens, r.completionTokens, r.meanLatencyMs, r.proposals.approvalRate, r.refinementSteps.approvalRate, r.postWrite.writes,
      ...['parser', 'l1', 'l2'].flatMap((l) => [r.postWrite.lastPerSessionMean[`${l}_error`], r.postWrite.lastPerSessionMean[`${l}_warning`]])].join(','))
  }
}
