#!/usr/bin/env node
/**
 * L2 (Z3) coverage statistics for .asfl specs.
 *   npm run build && node scripts/l2-coverage.mjs <spec.asfl>... [--json] [--timeout ms]
 * Per spec: FSF processes, mutual-exclusion pair checks and completeness checks split into
 * decided (SAT/UNSAT) / unknown / timeout / unsupported-skipped / informal-skipped,
 * plus a breakdown of unsupported constructs (counted per test condition and per skipped check).
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { check } from '../dist/index.js'
import { checkFsfL2 } from '../dist/fsf/l2Check.js'

const COMPOSITE = /field access|composite|composed|product|record/i

export async function coverage(source, { timeoutMs = 2000 } = {}) {
  const r = check(source)
  if (!r.ast) throw new Error('parse failed: ' + r.diagnostics.filter((d) => d.severity === 'error').map((d) => d.message).join('; '))
  const stats = []
  await checkFsfL2(r.ast, { timeoutMs, stats })
  const blank = () => ({ total: 0, sat: 0, unsat: 0, unknown: 0, timeout: 0, unsupported: 0, informal: 0 })
  const res = { fsfProcesses: stats.length, othersOnly: 0, l1Skipped: 0, exclusion: blank(), completeness: { ...blank(), byOthers: 0 },
    testConditions: { total: 0, encoded: 0, informal: 0, unsupported: 0, error: 0 }, unsupportedByTest: {}, unsupportedByCheck: {}, processes: stats }
  const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1 }
  const skipKind = (reasons) => reasons.every((x) => x === 'natural-language atom') ? 'informal' : 'unsupported'
  for (const s of stats) {
    if (s.skippedWhole === 'others-only') res.othersOnly++
    if (s.skippedWhole === 'l1-failed') res.l1Skipped++
    for (const t of s.tests) { res.testConditions.total++; bump(res.testConditions, t.status); if (t.status === 'unsupported') bump(res.unsupportedByTest, t.reason) }
    for (const e of s.exclusion) {
      res.exclusion.total++
      if (e.outcome === 'skipped') {
        const k = skipKind(e.skipReasons); res.exclusion[k]++
        if (k === 'unsupported') for (const x of new Set(e.skipReasons.filter((y) => y !== 'natural-language atom'))) bump(res.unsupportedByCheck, x)
      } else res.exclusion[e.outcome]++
    }
    if (s.skippedWhole === 'others-only' || s.completeness.outcome === 'others') { res.completeness.byOthers++; continue }
    if (s.skippedWhole) continue
    res.completeness.total++
    const c = s.completeness
    if (c.outcome === 'skipped') {
      const k = skipKind(c.skipReasons ?? []); res.completeness[k]++
      if (k === 'unsupported') for (const x of new Set((c.skipReasons ?? []).filter((y) => y !== 'natural-language atom'))) bump(res.unsupportedByCheck, x)
    } else res.completeness[c.outcome]++
  }
  // estimate: checks whose ONLY blocker is composite field access / composite types
  const onlyComposite = (reasons) => reasons.length > 0 && reasons.every((x) => COMPOSITE.test(x))
  const touchComposite = (reasons) => reasons.some((x) => COMPOSITE.test(x))
  res.compositeEstimate = {
    exclusionOnlyBlocker: stats.flatMap((s) => s.exclusion).filter((e) => e.outcome === 'skipped' && onlyComposite(e.skipReasons)).length,
    exclusionInvolved: stats.flatMap((s) => s.exclusion).filter((e) => e.outcome === 'skipped' && touchComposite(e.skipReasons)).length,
    completenessOnlyBlocker: stats.filter((s) => s.completeness.outcome === 'skipped' && !s.skippedWhole && onlyComposite(s.completeness.skipReasons ?? [])).length,
    testsOnlyComposite: stats.flatMap((s) => s.tests).filter((t) => t.status === 'unsupported' && COMPOSITE.test(t.reason)).length
  }
  return res
}

const isMain = process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))
if (isMain) {
  const args = process.argv.slice(2)
  const ti = args.indexOf('--timeout')
  const timeoutMs = ti >= 0 ? Number(args[ti + 1]) : 2000
  const files = args.filter((a, i) => !a.startsWith('--') && (ti < 0 || i !== ti + 1))
  const all = {}
  for (const f of files) all[basename(f)] = await coverage(readFileSync(f, 'utf-8'), { timeoutMs })
  if (args.includes('--json')) { console.log(JSON.stringify(all, null, 2)); process.exit(0) }
  for (const [f, r] of Object.entries(all)) {
    const { processes, ...summary } = r
    console.log(`\n== ${f}`)
    console.log(JSON.stringify(summary, null, 2))
  }
}
