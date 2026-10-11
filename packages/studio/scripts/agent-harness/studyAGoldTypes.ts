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

export interface GoldPackage {
  schemaVersion: typeof GOLD_SCHEMA_VERSION
  scenarioId: string
  partition: 'dev' | 'held-out'
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
