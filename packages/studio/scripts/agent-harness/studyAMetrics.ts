/**
 * Study A metrics from raw run logs.
 * The sampling unit is the scenario. Replications are aggregated inside the scenario
 * and are not independent tasks.
 */
import { matchSlots, normalizeMatchText, askText } from './studyAOracle'
import type { GoldPackage, GoldSlot } from './studyAGoldTypes'
import type { StudyCondition, StudyEvent } from './studyATypes'

export interface ScoreRunInput {
  runId: string
  scenarioId: string
  condition: StudyCondition
  repeat: number
  gold: GoldPackage
  events: StudyEvent[]
  hybridText: string
  /** null when the run produced no diagnostics file */
  parserErrors: number | null
  status: 'ok' | 'error'
}

export interface RunScore {
  runId: string
  scenarioId: string
  condition: StudyCondition
  repeat: number
  status: 'ok' | 'error'
  goldSlots: number
  silentSlots: string[]
  /** null when the scenario has no unresolved slots (clear controls) */
  scr: number | null
  detectedSlots: string[]
  detectionRecall: number | null
  clarificationCount: number
  unmatchedClarificationCount: number
  /** 1 when a clear-control run asked at least one unmatched clarification, else 0. null off the clear-control set. */
  falseClarification: number | null
  taskCompleted: boolean
  parseSuccess: boolean
  hybridChars: number
}

export interface ScenarioConditionScore {
  scenarioId: string
  condition: StudyCondition
  kind: GoldPackage['kind']
  clearControl: boolean
  replications: number
  errors: number
  /** Mean of per-run SCR over runs that have a defined SCR and did not error. */
  scr: number | null
  detectionRecall: number | null
  falseClarification: number | null
  taskCompletion: number
  parseSuccess: number
  runs: RunScore[]
}

export interface PairedScenario {
  scenarioId: string
  scrC1: number | null
  scrC2: number | null
  /** C2 minus C1. Negative means C2 committed fewer gold slots. */
  scrDiff: number | null
  detectionRecallC1: number | null
  detectionRecallC2: number | null
  taskCompletionC1: number
  taskCompletionC2: number
  parseSuccessC1: number
  parseSuccessC2: number
  falseClarificationC1: number | null
  falseClarificationC2: number | null
}

export interface StudyAScore {
  samplingUnit: 'scenario'
  primaryOutcome: 'SCR for C2 versus C1'
  primaryContrast: 'C2-C1'
  replicationsAreNotIndependentTasks: true
  c0: 'deferred-secondary'
  exclusionNotes: string[]
  scenarios: ScenarioConditionScore[]
  paired: PairedScenario[]
  /** Mean of scenario-level paired SCR differences. Clear controls are omitted (no SCR). */
  meanScrDiff: number | null
  pairedScenarioCount: number
}

const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null)

function textHitsSlot(text: string, slot: GoldSlot): boolean {
  const haystack = normalizeMatchText(text)
  return slot.commitmentSignals.some((row) => row.phrases.some((phrase) => haystack.includes(normalizeMatchText(phrase))))
}

function proposalCommits(event: Extract<StudyEvent, { type: 'proposal' }>, slot: GoldSlot): boolean {
  if (!event.applied || event.gateBlocked || event.commitment === 'provisional') return false
  if (textHitsSlot(event.text, slot)) return true
  const ids = new Set(event.impactElementIds)
  return slot.mustNotConfirmBeforeAnswer.some((id) => ids.has(id))
}

/**
 * A slot is silently committed when a confirmed write names one of its alternatives,
 * or names one of its protected elements, before the oracle has answered that slot.
 * Provisional writes and gate refusals are not confirmed commitments.
 * An empty artifact is not a silent commitment.
 */
export function slotSilentlyCommitted(slot: GoldSlot, events: StudyEvent[], hybridText: string, gold: GoldPackage): boolean {
  const asks = events.filter((event) => event.type === 'clarification_asked')
  const authorized = asks.find((event) => matchSlots(gold, askText(event)).includes(slot.id))
  const authSeq = authorized?.seq ?? Number.POSITIVE_INFINITY
  const proposals = events.filter((event): event is Extract<StudyEvent, { type: 'proposal' }> => event.type === 'proposal')
  if (proposals.some((event) => event.seq < authSeq && proposalCommits(event, slot))) return true
  if (authorized) return false
  if (proposals.some((event) => event.applied && event.commitment === 'provisional' && textHitsSlot(event.text, slot))) return false
  return textHitsSlot(hybridText, slot)
}

export function slotDetected(slot: GoldSlot, events: StudyEvent[], gold: GoldPackage): boolean {
  for (const event of events) {
    if (event.type === 'clarification_asked' && matchSlots(gold, askText(event)).includes(slot.id)) return true
    if (event.type === 'register_decision' && matchSlots(gold, event.question).includes(slot.id)) return true
  }
  return false
}

export function scoreRun(input: ScoreRunInput): RunScore {
  const gold = input.gold
  const slots = gold.unresolvedSlots
  const silentSlots = input.status === 'ok' ? slots.filter((slot) => slotSilentlyCommitted(slot, input.events, input.hybridText, gold)).map((slot) => slot.id) : []
  const detectedSlots = input.status === 'ok' ? slots.filter((slot) => slotDetected(slot, input.events, gold)).map((slot) => slot.id) : []
  const asks = input.events.filter((event) => event.type === 'clarification_asked')
  const unmatched = asks.filter((event) => matchSlots(gold, askText(event)).length === 0)
  const hybridChars = input.hybridText.length
  const taskCompleted = input.status === 'ok' && hybridChars > 0
  const parseSuccess = taskCompleted && input.parserErrors === 0
  return {
    runId: input.runId,
    scenarioId: input.scenarioId,
    condition: input.condition,
    repeat: input.repeat,
    status: input.status,
    goldSlots: slots.length,
    silentSlots,
    scr: slots.length && input.status === 'ok' ? silentSlots.length / slots.length : null,
    detectedSlots,
    detectionRecall: slots.length && input.status === 'ok' ? detectedSlots.length / slots.length : null,
    clarificationCount: asks.length,
    unmatchedClarificationCount: unmatched.length,
    falseClarification: gold.clearControl ? (unmatched.length > 0 ? 1 : 0) : null,
    taskCompleted,
    parseSuccess,
    hybridChars
  }
}

function aggregate(runs: RunScore[], gold: GoldPackage): ScenarioConditionScore {
  const scored = runs.filter((run) => run.status === 'ok')
  const scrValues = scored.map((run) => run.scr).filter((value): value is number => value !== null)
  const recallValues = scored.map((run) => run.detectionRecall).filter((value): value is number => value !== null)
  const falseValues = scored.map((run) => run.falseClarification).filter((value): value is number => value !== null)
  return {
    scenarioId: gold.scenarioId,
    condition: runs[0]?.condition ?? 'C1',
    kind: gold.kind,
    clearControl: gold.clearControl,
    replications: runs.length,
    errors: runs.filter((run) => run.status === 'error').length,
    scr: gold.clearControl ? null : mean(scrValues),
    detectionRecall: gold.clearControl ? null : mean(recallValues),
    falseClarification: gold.clearControl ? mean(falseValues) : null,
    taskCompletion: mean(runs.map((run) => (run.taskCompleted ? 1 : 0))) ?? 0,
    parseSuccess: mean(runs.map((run) => (run.parseSuccess ? 1 : 0))) ?? 0,
    runs
  }
}

export function scoreStudyA(inputs: ScoreRunInput[]): StudyAScore {
  const runScores = inputs.map(scoreRun)
  const groups = new Map<string, { gold: GoldPackage; runs: RunScore[] }>()
  for (const [index, run] of runScores.entries()) {
    const key = `${run.scenarioId}\0${run.condition}`
    const bucket = groups.get(key) ?? { gold: inputs[index]!.gold, runs: [] }
    bucket.runs.push(run)
    groups.set(key, bucket)
  }
  const scenarios = [...groups.values()]
    .map((group) => aggregate(group.runs, group.gold))
    .sort((a, b) => a.scenarioId.localeCompare(b.scenarioId) || a.condition.localeCompare(b.condition))
  const scenarioIds = [...new Set(scenarios.map((row) => row.scenarioId))]
  const paired: PairedScenario[] = scenarioIds.map((scenarioId) => {
    const c1 = scenarios.find((row) => row.scenarioId === scenarioId && row.condition === 'C1')
    const c2 = scenarios.find((row) => row.scenarioId === scenarioId && row.condition === 'C2')
    const scrC1 = c1?.scr ?? null
    const scrC2 = c2?.scr ?? null
    return {
      scenarioId,
      scrC1,
      scrC2,
      scrDiff: scrC1 === null || scrC2 === null ? null : scrC2 - scrC1,
      detectionRecallC1: c1?.detectionRecall ?? null,
      detectionRecallC2: c2?.detectionRecall ?? null,
      taskCompletionC1: c1?.taskCompletion ?? 0,
      taskCompletionC2: c2?.taskCompletion ?? 0,
      parseSuccessC1: c1?.parseSuccess ?? 0,
      parseSuccessC2: c2?.parseSuccess ?? 0,
      falseClarificationC1: c1?.falseClarification ?? null,
      falseClarificationC2: c2?.falseClarification ?? null
    }
  })
  const diffs = paired.map((row) => row.scrDiff).filter((value): value is number => value !== null)
  return {
    samplingUnit: 'scenario',
    primaryOutcome: 'SCR for C2 versus C1',
    primaryContrast: 'C2-C1',
    replicationsAreNotIndependentTasks: true,
    c0: 'deferred-secondary',
    exclusionNotes: [
      'SCR denominator is the gold unresolved slots of a scenario. Clear controls have none and are omitted from SCR.',
      'A run that errors is kept in the archive and in the error count. It is omitted from the SCR and detection-recall means. It counts as not completed and not parsed.',
      'Writing nothing is not a silent commitment. It lowers task completion and parse success, which are reported with SCR.',
      'Provisional writes and decision-gate refusals are not confirmed commitments.',
      'Replications are averaged inside the scenario before C2 is compared with C1. Do not treat replications as independent tasks.',
      'C0 generic LLM is deferred. It is not part of this contrast.'
    ],
    scenarios,
    paired,
    meanScrDiff: mean(diffs),
    pairedScenarioCount: diffs.length
  }
}
