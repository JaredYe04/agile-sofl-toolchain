/**
 * B0-auto condition: the existing rule-based informal -> hybrid generator (no LLM), i.e.
 * `refineAspecWithCheck` from @agile-sofl/aspec (refineToAsfl + fsfBuilder), run with default options.
 * Deterministic: same informal input -> same hybrid output. Writes the same run layout as the LLM
 * conditions (hybrid.asfl + manifest.json); there are no llm-calls (none are made).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { readInformal } from './informal'
import { join } from 'node:path'
import { refineAspecWithCheck } from '@agile-sofl/aspec'

export const B0_GENERATOR = '@agile-sofl/aspec refineAspecWithCheck (refineToAsfl + fsfBuilder), default options'

export function runB0Auto(o: { informalPath: string; outDir: string; runId: string; manifestExtra?: Record<string, unknown> }) {
  const runDir = join(o.outDir, 'runs', o.runId)
  mkdirSync(runDir, { recursive: true })
  const { text: informal, sha256: informalSha } = readInformal(o.informalPath)
  const r = refineAspecWithCheck(informal)
  writeFileSync(join(runDir, 'hybrid.asfl'), r.asflText)
  writeFileSync(join(runDir, 'manifest.json'), JSON.stringify({
    runId: o.runId, generator: B0_GENERATOR, informalSha256: informalSha, generatorCheckOk: r.checkOk,
    approvals: 0, stopReason: 'generator finished', llmCalls: 0, ...o.manifestExtra
  }, null, 2))
  return { runId: o.runId, runDir, hybridChars: r.asflText.length }
}
