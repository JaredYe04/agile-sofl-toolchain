/**
 * Usage (from packages/studio):  node scripts/agent-harness/build.mjs && node .harness/run.mjs \
 *   --informal <file.aspec> --conditions T,B2 --out <dir> [--max-approvals 3] [--system delivery]
 * Runs conditions serially, refuses to continue if prompt hashes differ, never prints the API key.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { appendKey, install429Retry, runOnce } from './core'
import { getEnvLlmFallback } from '../../src/main/services/llm/env'

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : def
}

async function main() {
  const userData = process.env.AGILE_SOFL_HARNESS_USERDATA!
  mkdirSync(userData, { recursive: true })
  // empty profile store -> the studio falls back to packages/studio/.env and never persists the key
  writeFileSync(join(userData, 'llm-profiles.json'), JSON.stringify({ activeId: null, profiles: [] }))
  const key = getEnvLlmFallback().apiKey
  if (!key) throw new Error('ECNU_API_KEY missing in packages/studio/.env')
  for (const stream of [process.stdout, process.stderr]) {
    const w = stream.write.bind(stream)
    stream.write = ((chunk: unknown, ...rest: unknown[]) => w(typeof chunk === 'string' ? chunk.split(key).join('[redacted]') : chunk, ...(rest as []))) as typeof stream.write
  }
  const out = resolve(arg('out', '.harness/out')!)
  mkdirSync(out, { recursive: true })
  install429Retry(join(out, 'retries.log'))
  const informal = resolve(arg('informal')!)
  const system = arg('system', 'system')!
  const conditions = arg('conditions', 'T')!.split(',') as Array<'T' | 'B2'>
  const maxApprovals = Number(arg('max-approvals', '3'))
  let hash: string | undefined
  for (const condition of conditions) {
    const r = await runOnce({ condition, informalPath: informal, outDir: out, maxApprovals })
    if (hash && r.promptHash !== hash) throw new Error(`prompt hash mismatch across conditions (${hash} vs ${r.promptHash})`)
    hash = r.promptHash
    appendKey(out, { ...r, system })
    console.log(JSON.stringify({ runId: r.runId, approvals: r.approvals, stopReason: r.stopReason, hybridChars: r.hybridChars, promptHash: r.promptHash.slice(0, 12) }))
  }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1) })
