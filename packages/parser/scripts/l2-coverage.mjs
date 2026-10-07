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

export function summarize(stats) {
  const blank = () => ({ total: 0, sat: 0, unsat: 0, unknown: 0, timeout: 0, unsupported: 0, informal: 0 })
  const res = { fsfProcesses: stats.length, othersOnly: 0, l1Skipped: 0, exclusion: blank(), completeness: { ...blank(), byOthers: 0 },
    testConditions: { total: 0, encoded: 0, informal: 0, unsupported: 0, error: 0 }, unsupportedByTest: {}, unsupportedByCheck: {} }
  const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1 }
  const skipKind = (reasons) => reasons.every((x) => x === 'natural-language atom') ? 'informal' : 'unsupported'
  let fullyDecided = 0
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
    const exclOk = s.exclusion.every((e) => e.outcome === 'sat' || e.outcome === 'unsat')
    if (s.skippedWhole === 'others-only' || s.completeness.outcome === 'others') { res.completeness.byOthers++; if (exclOk && s.skippedWhole !== 'l1-failed') fullyDecided++; continue }
    if (s.skippedWhole) continue
    res.completeness.total++
    const c = s.completeness
    if (c.outcome === 'skipped') {
      const k = skipKind(c.skipReasons ?? []); res.completeness[k]++
      if (k === 'unsupported') for (const x of new Set((c.skipReasons ?? []).filter((y) => y !== 'natural-language atom'))) bump(res.unsupportedByCheck, x)
    } else res.completeness[c.outcome]++
    if (exclOk && (c.outcome === 'sat' || c.outcome === 'unsat')) fullyDecided++
  }
  const pct = (x, n) => (n ? `${((100 * x) / n).toFixed(1)}%` : 'n/a')
  const decE = res.exclusion.sat + res.exclusion.unsat, decC = res.completeness.sat + res.completeness.unsat
  res.rates = {
    exclusionDecided: `${decE}/${res.exclusion.total} (${pct(decE, res.exclusion.total)})`,
    completenessDecidedOrOthers: `${decC + res.completeness.byOthers}/${stats.length} (${pct(decC + res.completeness.byOthers, stats.length)})`,
    processesFullyDecided: `${fullyDecided}/${stats.length} (${pct(fullyDecided, stats.length)})`
  }
  return res
}

const COMPOSITE_RE = COMPOSITE
export async function coverage(source, { timeoutMs = 2000 } = {}) {
  const r = check(source)
  if (!r.ast) throw new Error('parse failed: ' + r.diagnostics.filter((d) => d.severity === 'error').map((d) => d.message).join('; '))
  const stats = []
  await checkFsfL2(r.ast, { timeoutMs, stats })
  const text = (sp) => (sp ? source.slice(sp.start, sp.end).replace(/\s+/g, ' ').trim() : undefined)
  const leaf = stats.filter((s) => s.leaf), nonLeaf = stats.filter((s) => !s.leaf)
  // leaf processes whose pair checks were skipped (only) for natural-language atoms
  const informalList = (subset) => { const out = []; for (const s of subset) {
    const skipped = s.exclusion.filter((e) => e.outcome === 'skipped' && e.skipReasons.every((x) => x === 'natural-language atom'))
    const informalTests = s.tests.filter((t) => t.status === 'informal')
    if (!skipped.length && !informalTests.length) continue
    out.push({ module: s.module, process: s.process, scenarios: s.scenarios, hasOthers: s.hasOthers,
      informalPairChecksSkipped: skipped.length,
      informalTests: informalTests.map((t) => ({ index: t.index, atom: text(t.span), line: t.span?.line, test: text(t.testSpan) })) })
  } return out }
  const leafInformal = informalList(leaf), nonLeafInformal = informalList(nonLeaf)
  const onlyComposite = (reasons) => reasons.length > 0 && reasons.every((x) => COMPOSITE_RE.test(x))
  const touchComposite = (reasons) => reasons.some((x) => COMPOSITE_RE.test(x))
  return {
    all: summarize(stats), leaf: summarize(leaf), nonLeaf: summarize(nonLeaf), leafInformal, nonLeafInformal,
    compositeEstimate: {
      exclusionOnlyBlocker: stats.flatMap((s) => s.exclusion).filter((e) => e.outcome === 'skipped' && onlyComposite(e.skipReasons)).length,
      exclusionInvolved: stats.flatMap((s) => s.exclusion).filter((e) => e.outcome === 'skipped' && touchComposite(e.skipReasons)).length,
      completenessOnlyBlocker: stats.filter((s) => s.completeness.outcome === 'skipped' && !s.skippedWhole && onlyComposite(s.completeness.skipReasons ?? [])).length,
      testsOnlyComposite: stats.flatMap((s) => s.tests).filter((t) => t.status === 'unsupported' && COMPOSITE_RE.test(t.reason)).length
    },
    processes: stats.map((s) => ({ ...s, tests: s.tests.map(({ span, testSpan, ...t }) => t) }))
  }
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
  const row = (r) => [r.fsfProcesses, `${r.exclusion.total}`, `${r.exclusion.sat}/${r.exclusion.unsat}`, r.exclusion.unknown + r.exclusion.timeout, r.exclusion.informal, r.exclusion.unsupported,
    `${r.completeness.total}`, `${r.completeness.sat}/${r.completeness.unsat}`, r.completeness.byOthers, r.completeness.informal + r.completeness.unsupported,
    r.rates.exclusionDecided, r.rates.processesFullyDecided]
  console.log('| spec | subset | FSF procs | pair checks | SAT/UNSAT | unknown+timeout | skip informal | skip unsupported | compl. via solver | SAT/UNSAT | by others | compl. skipped | pairs decided | procs fully decided |')
  console.log('|' + '---|'.repeat(14))
  for (const [f, r] of Object.entries(all)) for (const k of ['all', 'leaf', 'nonLeaf']) console.log(`| ${f} | ${k} | ${row(r[k]).join(' | ')} |`)
  for (const [f, r] of Object.entries(all)) {
    console.log(`\n== ${f}: unsupported ${JSON.stringify(r.all.unsupportedByCheck)}; composite estimate ${JSON.stringify(r.compositeEstimate)}`)
    for (const [title, list] of [['LEAF', r.leafInformal], ['non-leaf (decomposed)', r.nonLeafInformal]]) {
    console.log(`${title} processes with natural-language test atoms (checked scenarios only): ${list.length ? '' : 'none'}`)
    for (const p of list) {
      console.log(`- ${p.module}.${p.process} (${p.scenarios} scenarios${p.hasOthers ? ' + others' : ''}; ${p.informalPairChecksSkipped} pair checks skipped)`)
      for (const t of p.informalTests) console.log(`    T${t.index} (line ${t.line}): atom "${t.atom}"${t.test !== t.atom ? `  | T: ${t.test}` : ''}`)
    }}
  }
}
