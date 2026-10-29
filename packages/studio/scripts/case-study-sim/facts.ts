import type {
  ClarificationFact,
  PhaseResult,
  ProposalFact,
  SessionEvent,
  Subject,
  SubjectFacts
} from './types'

export function clarificationsFromEvents(events: SessionEvent[]): ClarificationFact[] {
  return events
    .filter((e) => e.type === 'oracle_reply')
    .map((e) => ({
      phase: e.phase,
      question: String(e.question ?? ''),
      matched: e.matched === true,
      unmatched: e.unmatched === true || e.matched !== true,
      matchedSlotIds: Array.isArray(e.matchedSlotIds) ? e.matchedSlotIds.map(String) : [],
      answerPreview: String(e.answerPreview ?? '')
    }))
}

export function proposalsFromEvents(events: SessionEvent[]): ProposalFact[] {
  return events
    .filter((e) => e.type === 'proposal')
    .map((e) => ({
      phase: e.phase,
      tool: String(e.tool ?? 'unknown'),
      applied: e.applied === true,
      applyError: e.applyError != null ? String(e.applyError) : undefined,
      explanation: String(e.explanation ?? ''),
      target: e.target != null ? String(e.target) : undefined,
      opKinds: Array.isArray(e.opKinds) ? e.opKinds.map(String) : []
    }))
}

export function buildSubjectFacts(o: {
  subject: Subject
  startedAt: string
  endedAt: string
  dryRun: boolean
  modelAlias: string
  modelId: string
  temperature: number
  phases: PhaseResult[]
  events: SessionEvent[]
  informalChars: number
  hybridChars: number
  guiChars: number
}): SubjectFacts {
  const clarifications = clarificationsFromEvents(o.events)
  const proposals = proposalsFromEvents(o.events)
  return {
    participantId: o.subject.id,
    domain: o.subject.domain,
    yearsSpecWork: o.subject.yearsSpecWork,
    task: o.subject.task,
    initialModel: o.subject.initialModel,
    extension: o.subject.extension,
    startedAt: o.startedAt,
    endedAt: o.endedAt,
    dryRun: o.dryRun,
    modelAlias: o.modelAlias,
    modelId: o.modelId,
    temperature: o.temperature,
    phases: o.phases,
    approvals: o.phases.reduce((n, p) => n + p.approvals, 0),
    clarificationsAnswered: clarifications.length,
    stopReasons: o.phases.map((p) => `${p.phase}:${p.stopReason}`),
    informalChars: o.informalChars,
    hybridChars: o.hybridChars,
    guiChars: o.guiChars,
    eventCount: o.events.length,
    screenshotsPrepared: false,
    events: o.events,
    clarifications,
    proposals
  }
}
