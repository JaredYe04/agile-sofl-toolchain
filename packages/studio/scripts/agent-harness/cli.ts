/**
 * Headless agent CLI: informal .aspec in, hybrid .asfl out, no Electron UI.
 * The API key is read from the environment or an env file and is never printed.
 */
import { randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { getEnvLlmFallback } from '../../src/main/services/llm/env'
import { AGENT_SKILLS } from '../../src/main/services/llm/skills'
import { install429Retry, runOnce, type RunOptions } from './core'

const VALUE_FLAGS = new Set([
  'informal', 'out', 'initial-hybrid', 'task', 'task-file', 'skill',
  'max-approvals', 'clarification', 'clarification-file', 'dry-run-delay-ms', 'env-file'
])
const BOOL_FLAGS = new Set(['dry-run', 'checks', 'no-checks', 'help'])

export interface HeadlessOptions {
  informal: string
  out: string
  initialHybrid?: string
  task?: string
  taskFile?: string
  skillId: string
  maxApprovals: number
  clarification?: string
  clarificationFile?: string
  checks: boolean
  dryRun: boolean
  dryRunDelayMs: number
  envFile?: string
}

export class CliError extends Error {
  constructor(message: string, readonly exitCode = 1) {
    super(message)
    this.name = 'CliError'
  }
}

export function helpText(): string {
  const skills = AGENT_SKILLS.map((s) => s.id).join(', ')
  return `Agile-SOFL Studio headless agent CLI

Run the specification agent without the Electron UI.
Informal .aspec in, hybrid .asfl and a run directory out.

Usage:
  npm run agent:headless --workspace @agile-sofl/studio -- --informal <file.aspec> [options]
  node packages/studio/scripts/agent-harness/headless.mjs --informal <file.aspec> [options]

The launcher builds the bundle, then runs it with packages/studio as the working directory.

Options:
  --informal <file>            Informal specification (.aspec). Required.
  --out <dir>                  Output directory (default: .harness/out under packages/studio).
  --initial-hybrid <file>      Existing hybrid .asfl to revise. Omit to generate from the informal spec.
  --task <text>                Task sent to the agent. Default: generate a hybrid specification.
  --task-file <file>           Read the task from a UTF-8 file.
  --skill <id>                 Agent skill (default: hybrid-generation).
                               One of: ${skills}
  --max-approvals <n>          Stop after n auto-approved proposals (1-100, default 8).
  --clarification <text>       Reply used for every ask_clarification.
  --clarification-file <file>  Read that reply from a UTF-8 file.
  --checks                     Feed parser and semantic checks back to the agent (default).
  --no-checks                  Feed parser diagnostics only; skip semantic checks.
  --dry-run                    Local fake model. No network and no API key.
  --dry-run-delay-ms <ms>      Pause before each fake model call (0-60000, default 0).
  --env-file <path>            KEY=VALUE file. Does not override existing environment.
  --help, -h                   Show this help.

LLM (real runs):
  ECNU_API_KEY is required. Optional: ECNU_API_BASE_URL (default
  https://chat.ecnu.edu.cn/open/api/v1) and ECNU_MODEL (default ecnu-max).
  Set them in the environment or in packages/studio/.env. The endpoint must be
  an OpenAI-compatible chat API that supports tool calls. The key is never
  printed; stdout and stderr redact it.

Clarification:
  With no --clarification, each ask_clarification receives a fixed reply that
  no further stakeholder decision is available and the agent must not invent
  business rules. Pass --clarification to supply one reply for every question.

Output:
  <out>/hybrid.asfl                          hybrid specification
  <out>/runs/<id>/manifest.json              approvals, stop reason, prompt hash
  <out>/runs/<id>/.agile-sofl/llm-calls.jsonl
                                             model, tokens, and tool names
  <out>/retries.log                          HTTP 429/503 retries, when any occur
  One JSON summary line on stdout.
`
}

/** Load KEY=VALUE lines. Existing non-empty environment variables win. Never prints values. */
export function loadEnvFile(path: string): boolean {
  if (!existsSync(path)) return false
  for (const line of readFileSync(path, 'utf-8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const k = t.slice(0, t.indexOf('=')).trim()
    let v = t.slice(t.indexOf('=') + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (k && (process.env[k] == null || process.env[k] === '')) process.env[k] = v
  }
  return true
}

/** Replace occurrences of an API key in stdout and stderr. Returns a restore function. */
export function installKeyRedaction(secret: string): () => void {
  if (!secret) return () => {}
  const restores: Array<() => void> = []
  for (const stream of [process.stdout, process.stderr]) {
    const orig = stream.write.bind(stream)
    stream.write = ((chunk: unknown, ...rest: unknown[]) =>
      orig(typeof chunk === 'string' ? chunk.split(secret).join('[redacted]') : chunk, ...(rest as []))
    ) as typeof stream.write
    restores.push(() => { stream.write = orig as typeof stream.write })
  }
  return () => { for (const restore of restores) restore() }
}

function readTextFile(path: string, label: string): string {
  if (!existsSync(path)) throw new CliError(`${label} not found: ${path}`)
  return readFileSync(path, 'utf-8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}

export function projectNameFrom(informalPath: string): string {
  const base = basename(informalPath).replace(/\.aspec$/i, '')
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned.slice(0, 80) || 'specification'
}

export function parseCliArgs(argv: string[]): { help: true } | { error: string } | { options: HeadlessOptions } {
  const args = argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) return { help: true }
  const values = new Map<string, string>()
  const bools = new Set<string>()
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    if (!a.startsWith('--')) return { error: `Unexpected argument: ${a}` }
    const name = a.slice(2)
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
  if (!values.has('informal')) return { error: 'Missing required option: --informal <file.aspec>' }
  if (values.has('task') && values.has('task-file')) return { error: 'Use only one of --task and --task-file' }
  if (values.has('clarification') && values.has('clarification-file')) return { error: 'Use only one of --clarification and --clarification-file' }
  if (bools.has('checks') && bools.has('no-checks')) return { error: 'Use only one of --checks and --no-checks' }
  const maxRaw = values.get('max-approvals') ?? '8'
  if (!/^\d+$/.test(maxRaw)) return { error: '--max-approvals must be an integer from 1 to 100' }
  const maxApprovals = Number(maxRaw)
  if (maxApprovals < 1 || maxApprovals > 100) return { error: '--max-approvals must be an integer from 1 to 100' }
  const delayRaw = values.get('dry-run-delay-ms') ?? '0'
  if (!/^\d+$/.test(delayRaw)) return { error: '--dry-run-delay-ms must be an integer from 0 to 60000' }
  const dryRunDelayMs = Number(delayRaw)
  if (dryRunDelayMs > 60_000) return { error: '--dry-run-delay-ms must be an integer from 0 to 60000' }
  const skillId = values.get('skill') ?? 'hybrid-generation'
  if (!AGENT_SKILLS.some((s) => s.id === skillId)) return { error: `Unknown --skill ${skillId}. Run --help for the list.` }
  return {
    options: {
      informal: values.get('informal')!,
      out: values.get('out') ?? '.harness/out',
      initialHybrid: values.get('initial-hybrid'),
      task: values.get('task'),
      taskFile: values.get('task-file'),
      skillId,
      maxApprovals,
      clarification: values.get('clarification'),
      clarificationFile: values.get('clarification-file'),
      checks: !bools.has('no-checks'),
      dryRun: bools.has('dry-run'),
      dryRunDelayMs,
      envFile: values.get('env-file')
    }
  }
}

function sse(chunks: unknown[]): Response {
  const body = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n'
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

/** Local fake model: a few hybrid proposals, then a short completion. No network. */
const DRY_RUN_PROPOSALS = 3
export function installLocalDryRunFetch(delayMs = 0): void {
  globalThis.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
    const body = JSON.parse(String(init?.body ?? '{}')) as { messages?: Array<{ role: string }> }
    const toolResults = body.messages?.filter((m) => m.role === 'tool').length ?? 0
    const usage = { model: 'dry-run', choices: [], usage: { prompt_tokens: 0, completion_tokens: 0 } }
    if (toolResults >= DRY_RUN_PROPOSALS) {
      return sse([{ model: 'dry-run', choices: [{ delta: { content: 'dry-run done' }, finish_reason: 'stop' }] }, usage])
    }
    const name = `SYSTEM_DryRun${toolResults + 1}`
    const call = {
      index: 0,
      id: `dry-${randomBytes(3).toString('hex')}`,
      function: {
        name: 'propose_hybrid_changes',
        arguments: JSON.stringify({ explanation: 'dry run', operations: [{ op: 'add', kind: 'module', name }] })
      }
    }
    return sse([
      { model: 'dry-run', choices: [{ delta: { tool_calls: [call] } }] },
      { model: 'dry-run', choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
      usage
    ])
  }) as typeof fetch
}

function snapshotEnv(): Record<string, string | undefined> {
  return { ...process.env }
}

function restoreEnv(snap: Record<string, string | undefined>): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in snap)) delete process.env[key]
  }
  for (const [key, value] of Object.entries(snap)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

export interface HeadlessResult {
  runId: string
  out: string
  hybrid: string
  approvals: number
  stopReason: string
  hybridChars: number
  checks: boolean
  dryRun: boolean
  promptHash: string
}

export async function executeHeadless(o: HeadlessOptions): Promise<HeadlessResult> {
  const envSnap = snapshotEnv()
  const prevFetch = globalThis.fetch
  let restoreRedaction = () => {}
  let userKey = ''
  try {
    if (o.envFile) {
      const envPath = resolve(o.envFile)
      if (!existsSync(envPath)) throw new CliError(`env file not found: ${envPath}`)
      loadEnvFile(envPath)
    }
    userKey = getEnvLlmFallback().apiKey.trim()
    if (!userKey && !o.dryRun) {
      throw new CliError('ECNU_API_KEY is not set. Put it in the environment, packages/studio/.env, or --env-file. Use --dry-run to run without an LLM.')
    }
    if (!process.env.ECNU_API_KEY?.trim()) process.env.ECNU_API_KEY = 'dry-run-placeholder'
    restoreRedaction = userKey ? installKeyRedaction(userKey) : () => {}

    const informalPath = resolve(o.informal)
    if (!existsSync(informalPath)) throw new CliError(`informal specification not found: ${informalPath}`)
    const out = resolve(o.out)
    mkdirSync(out, { recursive: true })
    const initialHybridAsfl = o.initialHybrid ? readTextFile(resolve(o.initialHybrid), 'hybrid specification') : undefined
    let userText = o.task
    if (o.taskFile) userText = readTextFile(resolve(o.taskFile), 'task file').trim()
    if (userText !== undefined && !userText.trim()) userText = undefined
    let clarificationAnswer = o.clarification
    if (o.clarificationFile) clarificationAnswer = readTextFile(resolve(o.clarificationFile), 'clarification file').trim()

    const userData = process.env.AGILE_SOFL_HARNESS_USERDATA || join(process.cwd(), '.harness', 'userdata')
    process.env.AGILE_SOFL_HARNESS_USERDATA = userData
    mkdirSync(userData, { recursive: true })
    writeFileSync(join(userData, 'llm-profiles.json'), JSON.stringify({ activeId: null, profiles: [] }))
    process.env.AGILE_SOFL_HEADLESS = '1'
    // Studio's agent reads this switch to decide whether semantic checks are included. Not printed.
    process.env.AGILE_SOFL_CONDITION = o.checks ? 'T' : 'B2'

    if (o.dryRun) installLocalDryRunFetch(o.dryRunDelayMs)
    install429Retry(join(out, 'retries.log'))

    const runOptions: RunOptions = {
      condition: o.checks ? 'T' : 'B2',
      informalPath,
      outDir: out,
      skillId: o.skillId,
      userText,
      maxApprovals: o.maxApprovals,
      maxRounds: Math.max(20, o.maxApprovals + 8),
      clarificationAnswer,
      participantId: 'local',
      projectName: projectNameFrom(informalPath),
      initialHybridAsfl,
      manifestExtra: { checks: o.checks, dryRun: o.dryRun, projectName: projectNameFrom(informalPath) }
    }
    const r = await runOnce(runOptions)
    const hybrid = join(out, 'hybrid.asfl')
    copyFileSync(join(r.runDir, 'hybrid.asfl'), hybrid)
    const summary: HeadlessResult = {
      runId: r.runId,
      out,
      hybrid,
      approvals: r.approvals,
      stopReason: r.stopReason,
      hybridChars: r.hybridChars,
      checks: o.checks,
      dryRun: o.dryRun,
      promptHash: r.promptHash.slice(0, 12)
    }
    console.log(JSON.stringify(summary))
    return summary
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const redacted = userKey ? msg.split(userKey).join('[redacted]') : msg
    throw new CliError(redacted, e instanceof CliError ? e.exitCode : 1)
  } finally {
    restoreRedaction()
    globalThis.fetch = prevFetch
    restoreEnv(envSnap)
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
    await executeHeadless(parsed.options)
    return 0
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return e instanceof CliError ? e.exitCode : 1
  }
}
