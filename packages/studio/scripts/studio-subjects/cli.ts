/**
 * CLI for the Studio subject runner (P4–P23).
 * --help, --dry-run, and --generate-models do not need an API key.
 * The key is read from the environment or an env file and is never printed.
 */
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { getEnvLlmFallback } from '../../src/main/services/llm/env'
import { install429Retry } from '../agent-harness/core'
import { runSubject } from './driver'
import { loadAgentModels, writeAgentModels } from './models'
import { loadSubjects, selectSubjects, subjectsAssetsDir, SUBJECT_ID_RE } from './subjects'
import type { Pace, Subject } from './types'

const VALUE_FLAGS = new Set(['out', 'env-file', 'subjects', 'concurrency', 'max-decisions'])
const BOOL_FLAGS = new Set(['help', 'dry-run', 'pilot', 'all', 'generate-models'])

export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode = 1
  ) {
    super(message)
    this.name = 'CliError'
  }
}

export function helpText(): string {
  return `Agile-SOFL Studio subject runner (P4–P23)

Drives the real Studio agent loop and the same main-process Apply/Reject
services the Agent panel uses (applyStudioProposal + resumeWithToolResult).
It does not auto-approve in the same tick. Each pending proposal waits for a
subject-specific thinking time, then Accept or Reject.

This is not packages/studio/scripts/agent-harness (electron-stub + immediate
auto-approve) and not the old case-study-sim immediate-apply driver.

Usage (from the repository root):
  node packages/studio/scripts/studio-subjects/studio-subjects.mjs --help
  node packages/studio/scripts/studio-subjects/studio-subjects.mjs --generate-models
  node packages/studio/scripts/studio-subjects/studio-subjects.mjs --dry-run --subjects P4
  node packages/studio/scripts/studio-subjects/studio-subjects.mjs --dry-run --pilot
  node packages/studio/scripts/studio-subjects/studio-subjects.mjs --pilot
  node packages/studio/scripts/studio-subjects/studio-subjects.mjs --all

npm (working directory becomes packages/studio):
  npm run subjects:studio --workspace @agile-sofl/studio -- --help

Options:
  --help, -h             Print this text and exit 0. No key, no network.
  --generate-models      Rewrite scripts/studio-subjects/models/P4.json–P23.json
                         from subjects.json and exit 0. No key.
  --dry-run              Local fake model. No network and no API key.
                         Thinking time is still seconds-scale (compressed to 1–2.2s).
                         The sampled human time is stored as intendedThinkingMs.
  --pilot                Subjects P4, P5, and P6.
  --all                  Subjects P4–P23, in order.
  --subjects P4,P6       Explicit ids. Cannot be combined with --pilot or --all.
  --out <dir>            Output directory. Default: .harness/studio-subjects/<stamp>
                         under packages/studio (gitignored).
  --env-file <path>      KEY=VALUE file. Does not override existing environment.
  --concurrency <n>      1 or 2. Default 1. HTTP inside one subject stays serial.
  --max-decisions <n>    Accept/Reject decisions per phase (1–40).
                         Default 8, or 2 with --dry-run.

LLM (real runs):
  ECNU_API_KEY is required. Optional: ECNU_API_BASE_URL (default
  https://chat.ecnu.edu.cn/open/api/v1) and ECNU_MODEL (default ecnu-max).
  Set them in the environment, in packages/studio/.env, or pass --env-file.
  The key is never printed. stdout and stderr redact it.
  An empty profile list is written under .harness/userdata so the key is not
  copied into a profile store. ecnu_api_key is accepted as an alias of
  ECNU_API_KEY and is not printed.

Decisions:
  Production waits the sampled thinking time (proposal minimum 3 seconds,
  and never under 2 seconds). Larger patches draw a longer time.
  Dry-run records that sample and sleeps a compressed 1.0–2.2 seconds.
  There is no switch that approves in a few milliseconds.

Output (per subject):
  <out>/<id>/manifest.json       decisions, timing, stop reasons
  <out>/<id>/events.jsonl        clarification and proposal decisions
  <out>/<id>/agent-model.json    the policy that drove Accept/Reject
  <out>/<id>/task-brief.md       task packet sent to the agent
  <out>/<id>/project/            Studio project (informal.aspec, hybrid.asfl,
                                 gui.html, .agile-sofl/agent/sessions,
                                 .agile-sofl/llm-calls.jsonl)
  One JSON summary on stdout.
`
}

export interface SubjectCliOptions {
  generateModels: boolean
  dryRun: boolean
  mode: 'pilot' | 'all' | 'ids'
  ids?: string[]
  out?: string
  envFile?: string
  concurrency: number
  maxDecisions?: number
}

export function parseCliArgs(argv: string[]): { help: true } | { error: string } | { options: SubjectCliOptions } {
  const args = argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) return { help: true }
  const values = new Map<string, string>()
  const bools = new Set<string>()
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (!arg.startsWith('--')) return { error: `Unexpected argument: ${arg}` }
    const name = arg.slice(2)
    if (BOOL_FLAGS.has(name)) {
      bools.add(name)
      continue
    }
    if (!VALUE_FLAGS.has(name)) return { error: `Unknown option: --${name}` }
    const value = args[i + 1]
    if (value === undefined || value.startsWith('--')) return { error: `Missing value for --${name}` }
    if (values.has(name)) return { error: `Repeated option: --${name}` }
    values.set(name, value)
    i++
  }
  const generateModels = bools.has('generate-models')
  if (generateModels && (bools.size > 1 || values.size > 0)) {
    return { error: '--generate-models does not take other options' }
  }
  if (generateModels) {
    return { options: { generateModels: true, dryRun: false, mode: 'all', concurrency: 1 } }
  }
  const modes = [bools.has('pilot') ? 'pilot' : '', bools.has('all') ? 'all' : '', values.has('subjects') ? 'ids' : ''].filter(
    Boolean
  )
  if (modes.length !== 1) return { error: 'Choose one of --pilot, --all, or --subjects <ids>.' }
  let ids: string[] | undefined
  if (values.has('subjects')) {
    ids = values
      .get('subjects')!
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
    if (!ids.length) return { error: '--subjects needs at least one id' }
    for (const id of ids) {
      if (!SUBJECT_ID_RE.test(id)) return { error: `Unknown subject ${id}. Expected P4–P23.` }
    }
  }
  const concurrencyRaw = values.get('concurrency') ?? '1'
  if (!/^\d+$/.test(concurrencyRaw)) return { error: '--concurrency must be 1 or 2' }
  const concurrency = Number(concurrencyRaw)
  if (concurrency < 1 || concurrency > 2) return { error: '--concurrency must be 1 or 2' }
  let maxDecisions: number | undefined
  if (values.has('max-decisions')) {
    const raw = values.get('max-decisions')!
    if (!/^\d+$/.test(raw)) return { error: '--max-decisions must be an integer from 1 to 40' }
    maxDecisions = Number(raw)
    if (maxDecisions < 1 || maxDecisions > 40) return { error: '--max-decisions must be an integer from 1 to 40' }
  }
  return {
    options: {
      generateModels: false,
      dryRun: bools.has('dry-run'),
      mode: modes[0] as 'pilot' | 'all' | 'ids',
      ids,
      out: values.get('out'),
      envFile: values.get('env-file'),
      concurrency,
      maxDecisions
    }
  }
}

function loadEnvFile(path: string): void {
  if (!existsSync(path)) throw new CliError(`env file not found: ${path}`)
  for (const line of readFileSync(path, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const key = trimmed.slice(0, trimmed.indexOf('=')).trim()
    let value = trimmed.slice(trimmed.indexOf('=') + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key && (process.env[key] == null || process.env[key] === '')) process.env[key] = value
  }
}

function installKeyRedaction(secret: string): () => void {
  if (!secret) return () => {}
  const restores: Array<() => void> = []
  for (const stream of [process.stdout, process.stderr]) {
    const orig = stream.write.bind(stream)
    stream.write = ((chunk: unknown, ...rest: unknown[]) =>
      orig(typeof chunk === 'string' ? chunk.split(secret).join('[redacted]') : chunk, ...(rest as []))
    ) as typeof stream.write
    restores.push(() => {
      stream.write = orig as typeof stream.write
    })
  }
  return () => {
    for (const restore of restores) restore()
  }
}

function sse(chunks: unknown[]): Response {
  const body = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n'
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

function toolChunk(name: string, args: unknown, id: string) {
  return {
    index: 0,
    id,
    function: { name, arguments: JSON.stringify(args) }
  }
}

/** Local fake model: one clarification, one proposal, then a short stop. No network. */
export function installSubjectDryRunFetch(): void {
  globalThis.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      messages?: Array<{ role: string; content?: string | null }>
    }
    const messages = body.messages ?? []
    const toolResults = messages.filter((message) => message.role === 'tool').length
    const usage = { model: 'dry-run', choices: [], usage: { prompt_tokens: 0, completion_tokens: 0 } }
    if (toolResults >= 2) {
      return sse([{ model: 'dry-run', choices: [{ delta: { content: 'dry-run done' }, finish_reason: 'stop' }] }, usage])
    }
    const userText = messages
      .filter((message) => message.role === 'user')
      .map((message) => String(message.content ?? ''))
      .join('\n')
    if (toolResults === 0) {
      const call = toolChunk(
        'ask_clarification',
        {
          question: `请确认任务包里的初始范围：${userText.slice(0, 240)}`,
          options: [{ id: 'confirm', label: '按任务包事实' }],
          allowCustom: true
        },
        `dry-ask-${randomBytes(3).toString('hex')}`
      )
      return sse([
        { model: 'dry-run', choices: [{ delta: { tool_calls: [call] } }] },
        { model: 'dry-run', choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
        usage
      ])
    }
    const informal = userText.includes('Informal 阶段')
    const phaseTag = informal ? 'Inf' : userText.includes('扩展阶段') ? 'Ext' : 'Hyb'
    const call = informal
      ? toolChunk(
          'propose_changes',
          {
            explanation: 'dry-run informal',
            operations: [
              {
                op: 'add',
                target: 'functions',
                node: { type: 'function', title: 'Dry run function', description: 'Added by the local dry-run model.' }
              }
            ]
          },
          `dry-inf-${randomBytes(3).toString('hex')}`
        )
      : toolChunk(
          'propose_hybrid_changes',
          {
            explanation: 'dry-run hybrid',
            operations: [{ op: 'add', kind: 'module', name: `${phaseTag}${toolResults}` }]
          },
          `dry-hyb-${randomBytes(3).toString('hex')}`
        )
    return sse([
      { model: 'dry-run', choices: [{ delta: { tool_calls: [call] } }] },
      { model: 'dry-run', choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
      usage
    ])
  }) as typeof fetch
}

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

async function mapPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  let index = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index]!
      index += 1
      await fn(current)
    }
  })
  await Promise.all(workers)
}

export async function executeSubjects(o: SubjectCliOptions): Promise<number> {
  const assetsDir = subjectsAssetsDir()
  if (o.generateModels) {
    const written = writeAgentModels(assetsDir, loadSubjects(assetsDir))
    console.log(JSON.stringify({ generated: written.map((model) => model.id), dir: join(assetsDir, 'models') }))
    return 0
  }
  const pace: Pace = o.dryRun ? 'dry-run' : 'production'
  const maxDecisions = o.maxDecisions ?? (o.dryRun ? 2 : 8)
  const subjects = selectSubjects(loadSubjects(assetsDir), o.mode, o.ids)
  const models = loadAgentModels(assetsDir, subjects)
  const out = resolve(o.out ?? join('.harness', 'studio-subjects', stamp()))
  mkdirSync(out, { recursive: true })
  const prevFetch = globalThis.fetch
  let restoreRedaction = () => {}
  let secret = ''
  try {
    if (o.envFile) loadEnvFile(resolve(o.envFile))
    if (!process.env.ECNU_API_KEY?.trim() && process.env.ecnu_api_key?.trim()) {
      process.env.ECNU_API_KEY = process.env.ecnu_api_key.trim()
    }
    secret = getEnvLlmFallback().apiKey.trim()
    if (!secret && !o.dryRun) {
      throw new CliError(
        'ECNU_API_KEY is not set. Put it in the environment, packages/studio/.env, or --env-file. Use --dry-run to run without an LLM.'
      )
    }
    restoreRedaction = secret ? installKeyRedaction(secret) : () => {}
    if (!process.env.ECNU_API_KEY?.trim()) process.env.ECNU_API_KEY = 'dry-run-placeholder'
    const userData = process.env.AGILE_SOFL_HARNESS_USERDATA || join(process.cwd(), '.harness', 'userdata')
    process.env.AGILE_SOFL_HARNESS_USERDATA = userData
    mkdirSync(userData, { recursive: true })
    writeFileSync(join(userData, 'llm-profiles.json'), JSON.stringify({ activeId: null, profiles: [] }))
    if (o.dryRun) installSubjectDryRunFetch()
    install429Retry(join(out, 'retries.log'))
    const results: unknown[] = []
    let failed = 0
    await mapPool(subjects, o.concurrency, async (subject: Subject) => {
      const subjectOut = join(out, subject.id)
      try {
        const result = await runSubject({
          subject,
          model: models.get(subject.id)!,
          assetsDir,
          outDir: subjectOut,
          pace,
          maxDecisions
        })
        results.push(result)
        console.error(
          `${subject.id} decisions=${result.decisions} accept=${result.accepts} reject=${result.rejects} minSleptMs=${result.minSleptMs}`
        )
      } catch (error) {
        failed += 1
        const message = error instanceof Error ? error.message : String(error)
        results.push({ id: subject.id, error: secret ? message.split(secret).join('[redacted]') : message })
        console.error(`${subject.id} failed`)
      }
    })
    console.log(
      JSON.stringify({
        runtime: 'studio-main-process',
        pace,
        dryRun: o.dryRun,
        out,
        maxDecisions,
        concurrency: o.concurrency,
        subjects: subjects.map((subject) => subject.id),
        failed,
        results
      })
    )
    return failed > 0 ? 1 : 0
  } finally {
    restoreRedaction()
    globalThis.fetch = prevFetch
  }
}

export async function runCli(argv: string[]): Promise<number> {
  try {
    const parsed = parseCliArgs(argv)
    if ('help' in parsed) {
      console.log(helpText())
      return 0
    }
    if ('error' in parsed) {
      console.error(parsed.error)
      console.error('Run with --help for usage.')
      return 1
    }
    return await executeSubjects(parsed.options)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return error instanceof CliError ? error.exitCode : 1
  }
}
