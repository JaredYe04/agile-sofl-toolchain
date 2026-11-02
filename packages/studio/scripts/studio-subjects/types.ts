export type YearsSpecWork = 'lt2' | '2to5' | '5to10' | 'gt10'
export type TaskKind = 'greenfield' | 'extension'
export type PhaseName = 'informal' | 'hybrid' | 'extension'
export type Pace = 'production' | 'dry-run'

export type AuthorizedFact = {
  id: string
  /** Substrings used only to match ask_clarification to a task-packet fact. */
  keywords: string[]
  /** Verbatim task-packet fact. Not a participant quote. */
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
  seedInformal?: string
  seedHybrid?: string
  seedInformalFile?: string
  seedHybridFile?: string
  authorizedFacts: AuthorizedFact[]
  pilot?: boolean
}

export type ThinkingSpec = {
  distribution: 'lognormal'
  medianSeconds: number
  sigma: number
  /** Added to the median before sampling, per 1000 characters of the text being read. */
  secondsPerKChar: number
  minSeconds: number
  maxSeconds: number
}

export type DecisionPenalties = {
  perOp: number
  removeOp: number
  sourceEdit: number
  refineStep: number
  largePatchOps: number
  largePatch: number
}

/**
 * Per-subject decision policy. The runner interprets these numbers.
 * It does not branch on subject id.
 */
export type AgentModel = {
  id: string
  version: 1
  interpreter: 'studio-subject-policy-v1'
  source: 'subject-table'
  derivedFrom: {
    yearsSpecWork: YearsSpecWork
    task: TaskKind
    domain: string
  }
  /** Baseline probability of Accept before risk penalties. */
  acceptPropensity: number
  /** How hard risk penalties pull the accept probability down. */
  riskAversion: number
  penalties: DecisionPenalties
  /** Clarification replies come from authorized task-packet facts. */
  clarification: 'authorized-facts'
  proposalThink: ThinkingSpec
  clarificationThink: ThinkingSpec
  /** Stable stream seed for the decision RNG. */
  seed: number
  notes: string
}

export type PolicyDecision = 'accept' | 'reject'

export type ProposalDecision = {
  decision: PolicyDecision
  acceptProbability: number
  risk: number
  reasons: string[]
  thinkingMs: number
  draw: number
}
