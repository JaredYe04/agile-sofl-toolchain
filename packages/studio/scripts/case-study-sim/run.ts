/**
 * Case-study simulation CLI (P4–P23). Headless ChatECNU agent-loop on exp-freeze-v1.2.
 *
 *   node scripts/case-study-sim/build.mjs
 *   node .harness/case-study-sim.mjs --help
 *   node .harness/case-study-sim.mjs --dry-run --pilot
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { localIso } from '../agent-harness/core'
import { freezeStatus, requireFreeze } from './freeze-guard'
import { HELP, MAX_WORKERS } from './constants'
import { loadSimEnv, missingKeyError, redactStreams, resolveApiKey } from './env'
import { clampConcurrency } from './pool'
import { runCaseStudyBatch, type CaseStudyOptions } from './batch'
import { resolveAssetsDir } from './subjects'

function arg(argv: string[], name: string, def?: string): string | undefined {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : def
}

function gitTop(cwd: string): string {
  return execFileSync('git', ['-c', 'safe.directory=*', 'rev-parse', '--show-toplevel'], { cwd, encoding: 'utf-8' }).trim()
}

export function parseArgs(argv: string[]): {
  help: boolean
  dryRun: boolean
  mode: CaseStudyOptions['mode']
  subjectIds?: string[]
  out?: string
  envFile?: string
  concurrency: number
  maxApprovals?: number
} {
  if (argv.includes('--help') || argv.includes('-h')) {
    return { help: true, dryRun: false, mode: 'all', concurrency: MAX_WORKERS }
  }
  const subjects = arg(argv, 'subjects')
  let mode: CaseStudyOptions['mode'] = 'all'
  if (argv.includes('--pilot')) mode = 'pilot'
  else if (argv.includes('--expand')) mode = 'expand'
  else if (subjects) mode = 'ids'
  if (argv.includes('--skip-expand') && mode === 'all') mode = 'pilot'
  const concurrency = clampConcurrency(Number(arg(argv, 'concurrency', String(MAX_WORKERS))))
  const maxRaw = arg(argv, 'max-approvals')
  return {
    help: false,
    dryRun: argv.includes('--dry-run'),
    mode,
    subjectIds: subjects ? subjects.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    out: arg(argv, 'out'),
    envFile: arg(argv, 'env-file'),
    concurrency,
    maxApprovals: maxRaw != null ? Number(maxRaw) : undefined
  }
}

export async function runCli(argv = process.argv.slice(2)): Promise<{ code: number; out?: string }> {
  const parsed = parseArgs(argv)
  if (parsed.help) {
    console.log(HELP)
    return { code: 0 }
  }
  const here = dirname(fileURLToPath(import.meta.url))
  const repo = gitTop(here)
  const freeze = freezeStatus(repo)
  // Refuse before touching the key.
  requireFreeze(freeze, parsed.dryRun)

  const studio = join(repo, 'packages', 'studio')
  const origin = join(studio, '.harness', 'v12-origin.json')
  const originEnv = existsSync(origin) ? (JSON.parse(readFileSync(origin, 'utf-8')) as { envFile?: string }).envFile : undefined
  const envCandidates = [
    parsed.envFile ? resolve(parsed.envFile) : '',
    join(studio, '.env.ecnu'),
    join(studio, '.env'),
    originEnv ?? ''
  ].filter(Boolean)
  if (!parsed.dryRun) loadSimEnv(envCandidates)
  const userData = process.env.AGILE_SOFL_HARNESS_USERDATA || join(studio, '.harness', 'userdata')
  process.env.AGILE_SOFL_HARNESS_USERDATA = userData
  mkdirSync(userData, { recursive: true })
  writeFileSync(join(userData, 'llm-profiles.json'), JSON.stringify({ activeId: null, profiles: [] }))
  process.env.ECNU_API_BASE_URL ||= 'https://chat.ecnu.edu.cn/open/api/v1'

  if (parsed.dryRun) {
    if (!process.env.ECNU_API_KEY) process.env.ECNU_API_KEY = 'dry-run-placeholder'
  } else {
    const key = resolveApiKey()
    if (!key) throw missingKeyError()
    redactStreams(key)
  }

  const stamp = localIso().slice(0, 19).replace(/[:.]/g, '-')
  const out = resolve(parsed.out ?? join(studio, '.harness', `case-study-${stamp}${parsed.dryRun ? '-dry' : ''}`))
  const r = await runCaseStudyBatch({
    repo,
    out,
    mode: parsed.mode,
    subjectIds: parsed.subjectIds,
    dryRun: parsed.dryRun,
    concurrency: parsed.concurrency,
    maxApprovals: parsed.maxApprovals,
    assetsDir: resolveAssetsDir(join(studio, 'scripts', 'case-study-sim')),
    freeze
  })
  console.log(
    JSON.stringify({
      out: r.out,
      status: r.ok === r.total ? 'ok' : 'partial',
      ok: r.ok,
      total: r.total,
      dryRun: r.dryRun,
      freezeTag: r.freezeTag,
      toolchainCommit: r.toolchainCommit,
      stoppedAfterWave: r.stoppedAfterWave
    })
  )
  return { code: r.ok === r.total ? 0 : 1, out: r.out }
}

if (process.argv[1] && /case-study-sim\.(mjs|ts)$/.test(process.argv[1])) {
  runCli().then(
    (r) => process.exit(r.code),
    (e) => {
      console.error(e instanceof Error ? e.message : String(e))
      process.exit((e as { exitCode?: number }).exitCode ?? 1)
    }
  )
}
