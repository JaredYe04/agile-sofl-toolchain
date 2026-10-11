/**
 * Study A feature flag.
 * C1 = existing agent, decision gate off.
 * C2 = DASR on (records, impact links, decision gate, audit).
 * Default is C1 so an unset config does not change today's editor.
 * The flag does not change parser or refinement-obligation checks.
 */

export type DasrMode = 'C1' | 'C2'

export interface DasrFlag {
  enabled: boolean
  mode: DasrMode
  source: 'default' | 'env' | 'file'
}

const ON = new Set(['1', 'true', 'on', 'c2', 'yes'])
const OFF = new Set(['0', 'false', 'off', 'c1', 'no'])

export function resolveDasrMode(input?: {
  env?: NodeJS.ProcessEnv
  file?: { dasr?: unknown; dasrMode?: unknown } | null
}): DasrFlag {
  const env = input?.env ?? {}
  const raw = env.AGILE_SOFL_DASR
  if (raw !== undefined && String(raw).trim() !== '') {
    const v = String(raw).trim().toLowerCase()
    if (ON.has(v)) return { enabled: true, mode: 'C2', source: 'env' }
    return { enabled: false, mode: 'C1', source: 'env' }
  }
  const file = input?.file
  if (file) {
    if (typeof file.dasrMode === 'string') {
      const m = file.dasrMode.trim().toUpperCase()
      if (m === 'C2') return { enabled: true, mode: 'C2', source: 'file' }
      if (m === 'C1') return { enabled: false, mode: 'C1', source: 'file' }
    }
    if (typeof file.dasr === 'boolean') {
      return file.dasr
        ? { enabled: true, mode: 'C2', source: 'file' }
        : { enabled: false, mode: 'C1', source: 'file' }
    }
  }
  return { enabled: false, mode: 'C1', source: 'default' }
}

/**
 * Auto-write skips the human Apply click (structural approval) only.
 * It does not skip the decision gate. Ask mode requires both.
 */
export function structuralApprovalSkipped(mode: 'ask' | 'auto'): boolean {
  return mode === 'auto'
}

export function decisionGateSkipped(_mode: 'ask' | 'auto'): boolean {
  return false
}
