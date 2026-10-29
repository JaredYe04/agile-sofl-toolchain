export type YearsSpecWork = 'lt2' | '2to5' | '5to10' | 'gt10'
export type TaskKind = 'greenfield' | 'extension'

export type AuthorizedFact = {
  id: string
  /** Substrings used only to match ask_clarification to a task-packet fact. */
  keywords: string[]
  /** Verbatim task-packet fact. Not a fabricated participant quote. */
  text: string
}

export type Subject = {
  id: string
  domain: string
  yearsSpecWork: YearsSpecWork
  task: TaskKind
  project: string
  systemName: string
  initialModel: string
  extension: string
  /** Optional richer Informal seed (extension tasks). */
  seedInformal?: string
  /** Optional richer Hybrid seed (extension tasks). */
  seedHybrid?: string
  /** Relative to this script dir, e.g. fixtures/P6-FactoryMES-LineA.aspec */
  seedInformalFile?: string
  seedHybridFile?: string
  authorizedFacts: AuthorizedFact[]
  pilot?: boolean
}

export type PhaseName = 'informal' | 'hybrid' | 'extension'

export type SessionEvent = {
  at: string
  phase?: PhaseName
  type: string
  [k: string]: unknown
}

export type PhaseResult = {
  phase: PhaseName
  skillId: string
  approvals: number
  clarificationsAnswered: number
  clarificationsMatched: number
  clarificationsUnmatched: number
  stopReason: string
  tools: string[]
}

export type SubjectFacts = {
  participantId: string
  domain: string
  yearsSpecWork: YearsSpecWork
  task: TaskKind
  initialModel: string
  extension: string
  startedAt: string
  endedAt: string
  dryRun: boolean
  modelAlias: string
  modelId: string
  temperature: number
  phases: PhaseResult[]
  approvals: number
  clarificationsAnswered: number
  stopReasons: string[]
  informalChars: number
  hybridChars: number
  guiChars: number
  eventCount: number
  screenshotsPrepared: false
}

export type ExperienceJson = {
  formVersion: string
  submittedAt: string
  participantId: string
  domain: string
  yearsSpecWork: YearsSpecWork
  task: TaskKind
  initialModel: string
  extension: string
  probe: string
  feedback: string
  screenshotsPrepared: boolean
}

export type MetaJson = {
  subjectType: 'agent-simulated'
  participantId: string
  modelId: string
  modelAlias: string
  temperature: number
  toolchainCommit: string
  toolchainTag: string
  timeWindow: { startedAt: string; endedAt: string }
  materialsComplete: boolean
  dryRun: boolean
  project: string
  domain: string
  task: TaskKind
}
