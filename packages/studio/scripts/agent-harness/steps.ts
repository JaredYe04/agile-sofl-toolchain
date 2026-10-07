/**
 * Per-step snapshots for the batch runner (evaluation only, harness side).
 *
 * After every approved step the current spec is saved as runs/<id>/steps/<n>.asfl and, for coders,
 * blinded/<id>/steps/<n>.asfl. Each snapshot is checked by the FULL checker (parser + L1 + L2,
 * condition-independent, like final-diagnostics.json) and one row is appended to runs/<id>/steps.jsonl
 * and runs/<id>/steps.csv. B0-auto has a single snapshot (step 1 = generator output).
 */
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DiagnosticCounts } from '../../src/main/services/llm/experiment'

export interface StepRecord {
  step: number
  tool: string
  applied: boolean
  applyError: boolean
  chars: number
  parserErrors: number
  parserWarnings: number
  l1Errors: number
  l1Warnings: number
  l1Ran: boolean
  l2Errors: number
  l2Warnings: number
  l2Ran: boolean
  checkMs: number
}

export const STEP_CSV_COLUMNS: Array<keyof StepRecord> = [
  'step', 'tool', 'applied', 'applyError', 'chars',
  'parserErrors', 'parserWarnings', 'l1Errors', 'l1Warnings', 'l1Ran', 'l2Errors', 'l2Warnings', 'l2Ran', 'checkMs'
]

export interface StepInput { step: number; hybrid: string; tool: string; applied: boolean; applyError?: string }

/** Save the snapshot (run dir + blinded dir), check it, append to steps.jsonl/csv. */
export async function recordStep(
  o: { runDir: string; blindedDir: string; counts: (asfl: string) => Promise<DiagnosticCounts> },
  s: StepInput
): Promise<StepRecord> {
  for (const d of [join(o.runDir, 'steps'), join(o.blindedDir, 'steps')]) mkdirSync(d, { recursive: true })
  writeFileSync(join(o.runDir, 'steps', `${s.step}.asfl`), s.hybrid)
  writeFileSync(join(o.blindedDir, 'steps', `${s.step}.asfl`), s.hybrid)
  const t0 = Date.now()
  const c = await o.counts(s.hybrid)
  const rec: StepRecord = {
    step: s.step, tool: s.tool, applied: s.applied, applyError: !!s.applyError, chars: s.hybrid.length,
    parserErrors: c.parser.error, parserWarnings: c.parser.warning,
    l1Errors: c.l1.error, l1Warnings: c.l1.warning, l1Ran: c.l1.ran,
    l2Errors: c.l2.error, l2Warnings: c.l2.warning, l2Ran: c.l2.ran,
    checkMs: Date.now() - t0
  }
  appendFileSync(join(o.runDir, 'steps.jsonl'), JSON.stringify(rec) + '\n')
  const csv = join(o.runDir, 'steps.csv')
  if (!existsSync(csv)) writeFileSync(csv, STEP_CSV_COLUMNS.join(',') + '\n')
  appendFileSync(csv, STEP_CSV_COLUMNS.map((k) => String(rec[k])).join(',') + '\n')
  return rec
}

export interface StepAggregate {
  step: number
  /** runs that reached this step */
  runs: number
  /** runs whose snapshot parsed (L1/L2 ran) */
  parsed: number
  mean: { parserErrors: number; parserWarnings: number; l1Errors: number; l1Warnings: number; l2Errors: number; l2Warnings: number }
  zeroErrorRuns: number
}

const r3 = (x: number) => Math.round(x * 1000) / 1000
/** Per-step aggregate over the given runs (means over the runs that reached step n). */
export function aggregateSteps(runs: StepRecord[][]): StepAggregate[] {
  const byStep = new Map<number, StepRecord[]>()
  for (const recs of runs) for (const r of recs) byStep.set(r.step, [...(byStep.get(r.step) ?? []), r])
  return [...byStep.keys()].sort((a, b) => a - b).map((step) => {
    const rs = byStep.get(step)!
    const m = (k: keyof StepAggregate['mean']) => r3(rs.reduce((a, r) => a + r[k], 0) / rs.length)
    return {
      step, runs: rs.length, parsed: rs.filter((r) => r.l1Ran).length,
      mean: { parserErrors: m('parserErrors'), parserWarnings: m('parserWarnings'), l1Errors: m('l1Errors'), l1Warnings: m('l1Warnings'), l2Errors: m('l2Errors'), l2Warnings: m('l2Warnings') },
      zeroErrorRuns: rs.filter((r) => r.l1Ran && r.parserErrors + r.l1Errors + r.l2Errors === 0).length
    }
  })
}
