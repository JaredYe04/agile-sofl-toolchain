/**
 * Study A driver. One scenario (or a list) under C1 and C2, on the existing agent loop.
 *
 *   node scripts/agent-harness/build.mjs
 *   node .harness/study-a.mjs --scenario <gold.json> --conditions C1,C2 --repeats 1 --dry-run --score
 *   node .harness/study-a.mjs --list ../../research-reframing/study-a/held-out
 *
 * C1 sets AGILE_SOFL_DASR=0. C2 sets it to 1. Both use agent condition T.
 * C0 is refused: there is no fair generic-chat path on this harness.
 * Confirmatory runs require --confirmatory --freeze-tag <new-tag> and refuse exp-freeze-v1.2.
 * DEV scenarios are refused in confirmatory mode.
 */
import { randomBytes, randomInt } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { install429Retry, localIso, runOnce, setRetryContext } from './core'
import { installDryRunFetch, loadEnvFile } from './batch'
import { blockDesign, blockSchedule, parseSeed, type ScheduleItem } from './schedule'
import { freezeStatus, gitIn, harnessSha, isInside } from './freeze'
import { diagnosticCounts, getExperimentConfig } from '../../src/main/services/llm/experiment'
import { getEnvLlmFallback } from '../../src/main/services/llm/env'
import { goldFileSha256, loadGold } from './studyAGold'
import { printStudyAList } from './studyAList'
import type { GoldPackage } from './studyAGoldTypes'
import { createStakeholderOracle } from './studyAOracle'
import { createStudyEventLog, readStudyEvents } from './studyAEvents'
import { scoreStudyA, type ScoreRunInput } from './studyAMetrics'
import {
  assertConfirmatoryFreeze,
  buildStudyAConfig,
  CONFIRMATORY_FREEZE_NOTE,
  STUDY_A_SKILL_ID,
  STUDY_A_USER_TEXT,
  type StudyAConfig
} from './studyAConfig'
import type { StudyCondition } from './studyATypes'

const refuse = (msg: string) => Object.assign(new Error(msg), { exitCode: 2 })

export interface StudyAOptions {
  repo: string
  scenarioPaths: string[]
  conditions?: StudyCondition[]
  repeats?: number
  maxApprovals?: number
  out: string
  keyFile: string
  dryRun: boolean
  seed?: number
  confirmatory?: boolean
  freezeTag?: string
  allowHeldOut?: boolean
  harnessDir?: string
  goldSchemaPath?: string
  log?: (line: string) => void
}

interface RunRecord {
  order: number
  runId: string
  scenarioId: string
  condition: StudyCondition
  repeat: number
  block: number
  status: 'ok' | 'error'
  promptHash?: string
  approvals?: number
  stopReason?: string
  error?: string
}

export interface StudyAKey {
  study: 'A'
  confirmatory: boolean
  confirmatoryFreezeTag: string | null
  confirmatoryFreezeNote: string
  config: StudyAConfig
  createdAt: string
  out: string
  scenarioIds: string[]
  conditions: StudyCondition[]
  repeats: number
  maxApprovals: number
  seed: number
  design: ReturnType<typeof blockDesign>
  schedule: Array<ScheduleItem & { runId: string }>
  goldFiles: Record<string, string>
  goldSha256: Record<string, string>
  dryRun: boolean
  runs: RunRecord[]
}

/** Copy in-loop gate rows into the study log. The condition label on the telemetry line is dropped. */
function appendInLoopGateEvents(jsonlPath: string, log: ReturnType<typeof createStudyEventLog>): void {
  if (!existsSync(jsonlPath)) return
  for (const line of readFileSync(jsonlPath, 'utf-8').split('\n')) {
    if (!line.trim()) continue
    let row: { event?: string; allow?: unknown; disposition?: unknown; writePath?: unknown; elementIds?: unknown; decisionIds?: unknown }
    try { row = JSON.parse(line) } catch { continue }
    if (row.event !== 'decision_gate') continue
    const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
    log.append({
      type: 'decision_gate',
      allow: row.allow === true,
      disposition: typeof row.disposition === 'string' ? row.disposition : '',
      writePath: typeof row.writePath === 'string' ? row.writePath : '',
      elementIds: strings(row.elementIds),
      decisionIds: strings(row.decisionIds)
    })
  }
}

function materializeInformal(out: string, gold: GoldPackage): string {
  const dir = join(out, 'inputs')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `${gold.scenarioId}.aspec`)
  const text = gold.informalMarkdown.endsWith('\n') ? gold.informalMarkdown : `${gold.informalMarkdown}\n`
  writeFileSync(path, text)
  return path
}

export async function runStudyA(o: StudyAOptions): Promise<{ key: StudyAKey; keyFile: string }> {
  const log = o.log ?? ((line: string) => console.log(line))
  const conditions = o.conditions ?? ['C1', 'C2']
  if (conditions.some((condition) => condition !== 'C1' && condition !== 'C2')) {
    throw refuse('Study A conditions are C1 and C2. C0 is deferred; see research-reframing/analysis-plan.md.')
  }
  if (conditions.length === 0) throw refuse('at least one of C1, C2 is required')
  const repeats = o.repeats ?? 1
  const maxApprovals = o.maxApprovals ?? 8
  const out = resolve(o.out)
  const keyFile = resolve(o.keyFile)
  if (isInside(keyFile, out)) throw refuse(`--key-file must be outside --out (${keyFile} is inside ${out})`)
  const loaded = o.scenarioPaths.map((path) => ({ path: resolve(path), gold: loadGold(path) }))
  const ids = loaded.map((item) => item.gold.scenarioId)
  if (new Set(ids).size !== ids.length) throw refuse('scenario ids must be unique')
  for (const item of loaded) {
    if (item.gold.partition === 'held-out' && !o.allowHeldOut) {
      throw refuse(`${item.gold.scenarioId} is held-out. Refusing to run it from the dev command.`)
    }
    if (o.confirmatory && item.gold.partition !== 'held-out') {
      throw refuse(`${item.gold.scenarioId} is a DEV example. Confirmatory runs cannot use it.`)
    }
    if (o.confirmatory && item.gold.devExample) {
      throw refuse(`${item.gold.scenarioId} is marked devExample. Confirmatory runs cannot use it.`)
    }
  }
  const fz = freezeStatus(o.repo)
  let confirmatoryTag: string | null = null
  if (o.confirmatory) {
    if (!o.freezeTag) throw refuse(`Confirmatory Study A requires --freeze-tag. ${CONFIRMATORY_FREEZE_NOTE}`)
    let tagCommit = ''
    try {
      tagCommit = gitIn(o.repo)(['rev-parse', `${o.freezeTag}^{commit}`])
    } catch {
      throw refuse(`tag ${o.freezeTag} not found. ${CONFIRMATORY_FREEZE_NOTE}`)
    }
    assertConfirmatoryFreeze(o.freezeTag, fz.head, tagCommit)
    confirmatoryTag = o.freezeTag
  } else if (!fz.ok) {
    log(`[study-a] pilot freeze ${fz.freezeTag} does not match HEAD (${fz.reasons[0] ?? 'mismatch'}). Dev runs still record HEAD. ${CONFIRMATORY_FREEZE_NOTE}`)
  }
  const config = buildStudyAConfig({
    gitCommit: fz.head,
    pilotFreezeCommit: fz.freezeCommit,
    configuredModelId: o.dryRun ? (process.env.ECNU_MODEL || 'ecnu-max') : getEnvLlmFallback().model,
    harnessSha256: harnessSha(o.harnessDir ?? join(o.repo, 'packages', 'studio', 'scripts', 'agent-harness')),
    goldSchemaPath: o.goldSchemaPath
  })
  if (confirmatoryTag) {
    config.confirmatory = true
    config.confirmatoryFreezeTag = confirmatoryTag
  }
  const seed = o.seed ?? randomInt(0, 2 ** 31)
  const used = new Set<string>()
  const newId = () => {
    let id = ''
    do id = randomBytes(4).toString('hex')
    while (used.has(id))
    used.add(id)
    return id
  }
  const schedule = blockSchedule(ids, conditions, repeats, seed).map((item) => ({ ...item, runId: newId() }))
  const key: StudyAKey = {
    study: 'A',
    confirmatory: Boolean(confirmatoryTag),
    confirmatoryFreezeTag: confirmatoryTag,
    confirmatoryFreezeNote: CONFIRMATORY_FREEZE_NOTE,
    config,
    createdAt: localIso(),
    out,
    scenarioIds: ids,
    conditions,
    repeats,
    maxApprovals,
    seed,
    design: blockDesign(ids, conditions, repeats, seed),
    schedule,
    goldFiles: Object.fromEntries(loaded.map((item) => [item.gold.scenarioId, item.path])),
    goldSha256: Object.fromEntries(loaded.map((item) => [item.gold.scenarioId, goldFileSha256(item.path)])),
    dryRun: o.dryRun,
    runs: []
  }
  mkdirSync(out, { recursive: true })
  mkdirSync(dirname(keyFile), { recursive: true })
  mkdirSync(join(out, 'blinded'), { recursive: true })
  const informalByScenario = new Map(loaded.map((item) => [item.gold.scenarioId, materializeInformal(out, item.gold)]))
  const goldByScenario = new Map(loaded.map((item) => [item.gold.scenarioId, item.gold]))
  const oracleByScenario = new Map(loaded.map((item) => [item.gold.scenarioId, createStakeholderOracle(item.gold)]))
  if (o.dryRun) {
    if (!process.env.ECNU_API_KEY) process.env.ECNU_API_KEY = 'dry-run-placeholder'
    installDryRunFetch()
  }
  install429Retry(join(out, 'retries.log'))
  const evalCfg = getExperimentConfig(undefined, { AGILE_SOFL_CONDITION: 'T', AGILE_SOFL_TELEMETRY: '0' })
  const promptByScenario = new Map<string, string>()
  const save = () => writeFileSync(keyFile, JSON.stringify(key, null, 2))
  save()
  for (const item of schedule) {
    const scenarioId = item.system
    const condition = item.condition as StudyCondition
    const gold = goldByScenario.get(scenarioId)!
    const runId = item.runId
    setRetryContext(() => ({ run: runId, order: item.order }))
    const events = createStudyEventLog(join(out, 'runs', runId, 'study-events.jsonl'))
    const record: RunRecord = { order: item.order, runId, scenarioId, condition, repeat: item.repeat, block: item.block, status: 'error' }
    try {
      const result = await runOnce({
        condition: 'T',
        dasrMode: condition,
        informalPath: informalByScenario.get(scenarioId)!,
        outDir: out,
        skillId: STUDY_A_SKILL_ID,
        userText: STUDY_A_USER_TEXT,
        maxApprovals,
        runId,
        participantId: `study-a-${scenarioId}-r${item.repeat}`,
        resolveClarification: oracleByScenario.get(scenarioId)!,
        onStudyEvent: (event) => {
          events.append(event)
        },
        manifestExtra: {
          study: 'A',
          studyCondition: condition,
          scenarioId,
          repeat: item.repeat,
          goldSha256: key.goldSha256[scenarioId],
          confirmatory: key.confirmatory,
          confirmatoryFreezeTag: key.confirmatoryFreezeTag,
          confirmatoryFreezeNote: CONFIRMATORY_FREEZE_NOTE,
          configuredModelId: config.configuredModelId,
          temperature: config.temperature,
          gitCommit: config.gitCommit,
          dasrMode: condition
        }
      })
      const seen = promptByScenario.get(scenarioId)
      if (seen && seen !== result.promptHash) {
        throw refuse(`shared prompt hash drifted for ${scenarioId} between conditions`)
      }
      promptByScenario.set(scenarioId, result.promptHash)
      appendInLoopGateEvents(join(result.runDir, '.agile-sofl', 'llm-calls.jsonl'), events)
      const hybridPath = join(result.runDir, 'hybrid.asfl')
      const hybrid = existsSync(hybridPath) ? readFileSync(hybridPath, 'utf-8') : ''
      const diagnostics = await diagnosticCounts(hybrid, evalCfg)
      writeFileSync(join(result.runDir, 'final-diagnostics.json'), JSON.stringify({
        evaluationOnly: 'full checker on the final hybrid, independent of C1/C2',
        ...diagnostics
      }, null, 2))
      events.append({
        type: 'final_hybrid',
        chars: hybrid.length,
        parserErrors: diagnostics.parser.error,
        parseOk: hybrid.length > 0 && diagnostics.parser.error === 0
      })
      const blinded = join(out, 'blinded', runId)
      mkdirSync(blinded, { recursive: true })
      writeFileSync(join(blinded, 'final.asfl'), hybrid)
      record.status = 'ok'
      record.promptHash = result.promptHash
      record.approvals = result.approvals
      record.stopReason = result.stopReason
      log(`[study-a ${item.order}/${schedule.length}] ${scenarioId} ${condition} run ${runId} ok`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      record.error = message.slice(0, 300)
      log(`[study-a ${item.order}/${schedule.length}] ${scenarioId} ${condition} run ${runId} ERROR: ${message.slice(0, 200)}`)
      if ((error as { exitCode?: number }).exitCode === 2) throw error
    }
    key.runs.push(record)
    save()
  }
  writeFileSync(join(out, 'study-config.json'), JSON.stringify(config, null, 2))
  return { key, keyFile }
}

export function scoreStudyAKey(key: StudyAKey): ReturnType<typeof scoreStudyA> {
  const inputs: ScoreRunInput[] = key.runs.map((run) => {
    const runDir = join(key.out, 'runs', run.runId)
    const hybridPath = join(runDir, 'hybrid.asfl')
    const hybridText = existsSync(hybridPath) ? readFileSync(hybridPath, 'utf-8') : ''
    let parserErrors: number | null = null
    const diagnosticsPath = join(runDir, 'final-diagnostics.json')
    if (existsSync(diagnosticsPath)) {
      const diagnostics = JSON.parse(readFileSync(diagnosticsPath, 'utf-8')) as { parser?: { error?: number } }
      parserErrors = typeof diagnostics.parser?.error === 'number' ? diagnostics.parser.error : null
    }
    return {
      runId: run.runId,
      scenarioId: run.scenarioId,
      condition: run.condition,
      repeat: run.repeat,
      gold: loadGold(key.goldFiles[run.scenarioId]!),
      events: readStudyEvents(join(runDir, 'study-events.jsonl')),
      hybridText,
      parserErrors,
      status: run.status
    }
  })
  return scoreStudyA(inputs)
}

function arg(name: string, def?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : def
}

function scenarioArgs(): string[] {
  const paths: string[] = []
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === '--scenario' && process.argv[i + 1]) paths.push(process.argv[i + 1]!)
  }
  return paths
}

async function main() {
  const repo = execFileSync('git', ['-c', 'safe.directory=*', 'rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim()
  if (process.argv.includes('--list')) {
    printStudyAList()
    return
  }
  const scoreOnly = process.argv.includes('--score-only')
  if (scoreOnly) {
    const keyPath = arg('key') ?? arg('key-file')
    if (!keyPath) throw new Error('--score-only requires --key <keyFile>')
    const key = JSON.parse(readFileSync(resolve(keyPath), 'utf-8')) as StudyAKey
    const score = scoreStudyAKey(key)
    writeFileSync(join(key.out, 'metrics.json'), JSON.stringify(score, null, 2))
    console.log(JSON.stringify({ metrics: join(key.out, 'metrics.json'), samplingUnit: score.samplingUnit, primaryOutcome: score.primaryOutcome, meanScrDiff: score.meanScrDiff, pairedScenarioCount: score.pairedScenarioCount }))
    return
  }
  const dryRun = process.argv.includes('--dry-run')
  const scenarios = scenarioArgs()
  if (scenarios.length === 0) throw new Error('--scenario <gold.json> is required (repeat the flag for more than one)')
  const conditions = (arg('conditions', 'C1,C2') ?? 'C1,C2').split(',').map((item) => item.trim()).filter(Boolean) as StudyCondition[]
  if (conditions.includes('C0' as StudyCondition)) {
    throw refuse('C0 generic LLM is deferred. The studio has no fair tool-free chat path. Run C1,C2.')
  }
  const stamp = localIso().slice(0, 19).replace(/[:.]/g, '-')
  const out = resolve(arg('out', join(repo, 'packages', 'studio', '.harness', `study-a-${stamp}${dryRun ? '-dry' : ''}`))!)
  const keyFile = resolve(arg('key-file', join(repo, '..', 'agile-sofl-batch-keys', `study-a-${stamp}${dryRun ? '-dry' : ''}.key.json`))!)
  if (!dryRun) {
    const origin = join(repo, 'packages', 'studio', '.harness', 'v12-origin.json')
    const envFile = arg('env-file') ?? (existsSync(origin) ? (JSON.parse(readFileSync(origin, 'utf-8')) as { envFile?: string }).envFile : undefined)
    if (envFile) loadEnvFile(resolve(envFile))
    else loadEnvFile(join(repo, 'packages', 'studio', '.env'))
  }
  const userData = process.env.AGILE_SOFL_HARNESS_USERDATA || join(repo, 'packages', 'studio', '.harness', 'userdata')
  process.env.AGILE_SOFL_HARNESS_USERDATA = userData
  mkdirSync(userData, { recursive: true })
  writeFileSync(join(userData, 'llm-profiles.json'), JSON.stringify({ activeId: null, profiles: [] }))
  let key = ''
  if (!dryRun) {
    key = getEnvLlmFallback().apiKey
    if (!key) throw new Error('ECNU_API_KEY missing in packages/studio/.env')
  }
  for (const stream of [process.stdout, process.stderr]) {
    const write = stream.write.bind(stream)
    stream.write = ((chunk: unknown, ...rest: unknown[]) => {
      const safe = typeof chunk === 'string' && key ? chunk.split(key).join('[redacted]') : chunk
      return write(safe as string, ...(rest as []))
    }) as typeof stream.write
  }
  const seedArg = arg('seed')
  const seed = seedArg !== undefined ? parseSeed(seedArg) : randomInt(0, 2 ** 31)
  console.log(`seed: ${seed}${seedArg === undefined ? ' (generated)' : ''}`)
  const result = await runStudyA({
    repo,
    scenarioPaths: scenarios,
    conditions,
    repeats: Number(arg('repeats', '1')),
    maxApprovals: Number(arg('max-approvals', '8')),
    out,
    keyFile,
    dryRun,
    seed,
    confirmatory: process.argv.includes('--confirmatory'),
    freezeTag: arg('freeze-tag'),
    allowHeldOut: process.argv.includes('--allow-held-out'),
    goldSchemaPath: join(repo, 'research-reframing', 'study-a', 'schema', 'gold-package.schema.json')
  })
  const score = scoreStudyAKey(result.key)
  writeFileSync(join(result.key.out, 'metrics.json'), JSON.stringify(score, null, 2))
  console.log(JSON.stringify({
    out: result.key.out,
    keyFile: result.keyFile,
    conditions: result.key.conditions,
    scenarios: result.key.scenarioIds,
    runs: result.key.runs.length,
    ok: result.key.runs.filter((run) => run.status === 'ok').length,
    metrics: join(result.key.out, 'metrics.json'),
    confirmatoryFreezeTag: result.key.confirmatoryFreezeTag,
    dryRun: result.key.dryRun
  }))
}

if (process.argv[1] && /study-a(?:-run)?\.(mjs|ts)$/.test(process.argv[1].replace(/\\/g, '/'))) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit((error as { exitCode?: number }).exitCode ?? 1)
  })
}
