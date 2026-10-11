export const GOLD_SCHEMA_VERSION = 'study-a-gold-1'

export interface GoldAlternative {
  id: string
  label: string
}

export interface CommitmentSignal {
  alternativeId: string
  phrases: string[]
}

export interface GoldSlot {
  id: string
  question: string
  alternatives: GoldAlternative[]
  authorizedAlternativeId: string
  clarificationTarget: string
  /** Operational elements that must not be treated as confirmed before this slot is answered. */
  mustNotConfirmBeforeAnswer: string[]
  /** Exact text the oracle may return. It is the authorized alternative label. */
  stakeholderAnswer: string
  /** Case-insensitive substrings. A question hits the slot when any term appears. */
  matchTerms: string[]
  commitmentSignals: CommitmentSignal[]
}

export interface GoldMaintenance {
  changeRequest: string
  affectedElementIds: string[]
  unaffectedElementIds: string[]
}

export type GoldSet = 'dev' | 'held-out'
/** draft-gold awaits dual annotation. dev-example is a harness fixture. Neither is a confirmatory freeze. */
export type GoldAnnotationStatus = 'draft-gold' | 'dev-example'

export interface GoldPackage {
  schemaVersion: typeof GOLD_SCHEMA_VERSION
  scenarioId: string
  partition: GoldSet
  /** Same value as partition when present. Held-out files require set "held-out". */
  set?: GoldSet
  /** Held-out files require "draft-gold". This scaffold has no frozen status. */
  status?: GoldAnnotationStatus
  devExample: boolean
  confirmatory: false
  title: string
  domain: string
  kind: 'underspecified' | 'clear-control' | 'maintenance'
  clearControl: boolean
  naturalLanguageRequirements: string
  informalMarkdown: string
  unresolvedSlots: GoldSlot[]
  maintenance: GoldMaintenance | null
  qualityNotes: string
}
