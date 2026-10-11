import { evaluateDecisionGate } from './gate'
import { emptyLedger, registrationLabel } from './ledger'
import type { CommitmentClass, DecisionLedger, GateOverride, GateResult, ImpactDeclaration } from './types'
import type { DasrMode } from './flag'

export interface DasrRuntime {
  enabled: boolean
  mode: DasrMode
  ledger: DecisionLedger
  persist: ((ledger: DecisionLedger) => void) | null
  /** UI auto-write. Harness passes automaticMode on the gate call instead. */
  automaticMode: boolean
}

let runtime: DasrRuntime = {
  enabled: false,
  mode: 'C1',
  ledger: emptyLedger(),
  persist: null,
  automaticMode: false
}

export function resetDasrRuntime(): void {
  runtime = { enabled: false, mode: 'C1', ledger: emptyLedger(), persist: null, automaticMode: false }
}

export function setDasrAutomaticMode(on: boolean): void {
  runtime = { ...runtime, automaticMode: on }
}

export function installDasrRuntime(next: {
  enabled: boolean
  mode: DasrMode
  ledger: DecisionLedger
  persist?: ((ledger: DecisionLedger) => void) | null
}): void {
  runtime = {
    enabled: next.enabled,
    mode: next.mode,
    ledger: next.ledger,
    persist: next.persist ?? null,
    automaticMode: false
  }
}

export function dasrRuntimeSnapshot(): DasrRuntime & { label: string } {
  return { ...runtime, label: registrationLabel(runtime.ledger) }
}

export function screenRuntimeWrite(input: {
  writePath: string
  impact: ImpactDeclaration
  commitment?: CommitmentClass
  override?: GateOverride
  proposalId?: string
  now?: string
  automaticMode?: boolean
}): GateResult {
  const result = evaluateDecisionGate({
    dasrEnabled: runtime.enabled,
    ledger: runtime.ledger,
    impact: input.impact,
    commitment: input.commitment ?? 'confirmed',
    writePath: input.writePath,
    proposalId: input.proposalId,
    override: input.override,
    automaticMode: input.automaticMode ?? runtime.automaticMode,
    now: input.now
  })
  if (result.ledger !== runtime.ledger) {
    runtime = { ...runtime, ledger: result.ledger }
    if (result.ledger.registration === 'registered') runtime.persist?.(result.ledger)
  }
  return result
}
