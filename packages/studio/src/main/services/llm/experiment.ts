/**
 * Experiment switch + per-call LLM telemetry (evaluation of LLM-assisted hybrid spec construction).
 *
 * Configuration (env overrides <projectRoot>/.agile-sofl/experiment.json):
 *   AGILE_SOFL_CONDITION   experiment condition label, e.g. "B1" (agent + checks, default "B1")
 *                          or "B2" (agent on, semantic checks off)
 *   AGILE_SOFL_PARTICIPANT participant id (default "anonymous")
 *   AGILE_SOFL_TELEMETRY   "0" disables the JSONL log (default on)
 *   AGILE_SOFL_LOG_PROMPTS "1" also logs full prompt messages (default off)
 *   experiment.json: { "condition": "B2", "participantId": "P07", "telemetry": true, "logPrompts": false }
 *
 * Exact behaviour of condition B2 ("agent on, no checks"):
 *   - parser syntax / scope / type diagnostics are STILL fed back to the agent, and the forced
 *     post-write re-read (read_hybrid_specification after every applied write) still happens;
 *   - only the L1 (ASFL_FSF_101-104) and L2 (ASFL_FSF_201-209) semantic FSF checks are disabled:
 *     they are not run and not fed back to the agent;
 *   - telemetry still records them, as 0 counts with enabled=false.
 * In every other condition L1 and L2 diagnostics are added to the agent's diagnostics payload.
 *
 * Telemetry: one JSON object per line in <projectRoot>/.agile-sofl/llm-calls.jsonl.
 * API keys are never logged; prompts only when logPrompts is on (otherwise only their size).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { check, checkFsfL1, checkFsfL2, type Diagnostic } from '@agile-sofl/parser'

export interface ExperimentConfig {
  condition: string
  participantId: string
  /** L1 + L2 semantic checks run and are fed back to the agent */
  semanticChecks: boolean
  telemetry: boolean
  logPrompts: boolean
}

export function getExperimentConfig(projectRoot?: string, env: NodeJS.ProcessEnv = process.env): ExperimentConfig {
  let file: Partial<{ condition: string; participantId: string; telemetry: boolean; logPrompts: boolean }> = {}
  if (projectRoot) {
    const p = join(projectRoot, '.agile-sofl', 'experiment.json')
    try {
      if (existsSync(p)) file = JSON.parse(readFileSync(p, 'utf-8'))
    } catch { /* ignore malformed file */ }
  }
  const condition = String(env.AGILE_SOFL_CONDITION || file.condition || 'B1').trim()
  const participantId = String(env.AGILE_SOFL_PARTICIPANT || file.participantId || 'anonymous').trim()
  const telemetry = env.AGILE_SOFL_TELEMETRY !== undefined ? env.AGILE_SOFL_TELEMETRY !== '0' : file.telemetry !== false
  const logPrompts = env.AGILE_SOFL_LOG_PROMPTS !== undefined ? env.AGILE_SOFL_LOG_PROMPTS === '1' : file.logPrompts === true
  return { condition, participantId, semanticChecks: condition.toUpperCase() !== 'B2', telemetry, logPrompts }
}

export const isL1Code = (code: string) => /^ASFL_FSF_1\d\d$/.test(code)
export const isL2Code = (code: string) => /^ASFL_FSF_2\d\d$/.test(code)

export interface SeverityCount { error: number; warning: number }
export interface DiagnosticCounts {
  parser: SeverityCount
  l1: SeverityCount & { enabled: boolean }
  l2: SeverityCount & { enabled: boolean }
}

const count = (ds: Diagnostic[]): SeverityCount => ({
  error: ds.filter((d) => d.severity === 'error').length,
  warning: ds.filter((d) => d.severity === 'warning').length
})

/** L1 + L2 diagnostics for the agent (empty when semantic checks are disabled, i.e. B2). */
export async function semanticDiagnostics(asfl: string, cfg: ExperimentConfig): Promise<Diagnostic[]> {
  if (!cfg.semanticChecks || !asfl.trim()) return []
  const r = check(asfl, { fsfL1: false })
  if (!r.ast) return []
  return [...checkFsfL1(r.ast).diagnostics, ...(await checkFsfL2(r.ast)).diagnostics]
}

/** Post-write diagnostic counts split by layer (parser = parse/scope/type/FSF-classify/CDFD/data). */
export async function diagnosticCounts(asfl: string, cfg: ExperimentConfig): Promise<DiagnosticCounts> {
  const r = check(asfl, { fsfL1: false })
  const parser = count(r.diagnostics.filter((d) => !isL1Code(d.code) && !isL2Code(d.code)))
  if (!cfg.semanticChecks || !r.ast) {
    return { parser, l1: { error: 0, warning: 0, enabled: cfg.semanticChecks }, l2: { error: 0, warning: 0, enabled: cfg.semanticChecks } }
  }
  const l1 = count(checkFsfL1(r.ast).diagnostics)
  const l2 = count((await checkFsfL2(r.ast)).diagnostics)
  return { parser, l1: { ...l1, enabled: true }, l2: { ...l2, enabled: true } }
}

export type TelemetryEvent =
  | { event: 'llm_call'; model: string; promptTokens: number | null; completionTokens: number | null; latencyMs: number; ok: boolean; finishReason?: string; toolCalls?: string[]; promptChars?: number; prompt?: unknown; error?: string }
  | { event: 'proposal_decision'; tool: string; stepType?: string; decision: 'approved' | 'rejected' | 'error'; toolCallId: string }
  | { event: 'post_write_diagnostics'; toolCallId: string; diagnostics: DiagnosticCounts }

export function telemetryPath(projectRoot: string): string {
  return join(projectRoot, '.agile-sofl', 'llm-calls.jsonl')
}

const SECRET_KEYS = /^(api[-_]?key|authorization|token|secret|password)$/i
function scrub(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(scrub)
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v)) o[k] = SECRET_KEYS.test(k) ? '[redacted]' : scrub(x)
    return o
  }
  if (typeof v === 'string') return v.replace(/\b(sk-[A-Za-z0-9_-]{8,}|Bearer\s+\S+)/g, '[redacted]')
  return v
}

export function logTelemetry(
  projectRoot: string | undefined,
  cfg: ExperimentConfig,
  sessionId: string,
  ev: TelemetryEvent
): void {
  if (!projectRoot || !cfg.telemetry) return
  const rec: Record<string, unknown> = {
    ts: new Date().toISOString(),
    sessionId,
    participantId: cfg.participantId,
    condition: cfg.condition,
    ...ev
  }
  if (!cfg.logPrompts) delete rec.prompt
  try {
    mkdirSync(join(projectRoot, '.agile-sofl'), { recursive: true })
    appendFileSync(telemetryPath(projectRoot), JSON.stringify(scrub(rec)) + '\n', 'utf-8')
  } catch { /* telemetry must never break the agent */ }
}
