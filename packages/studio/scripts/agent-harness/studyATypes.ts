/**
 * Study A log types shared by the agent harness and the scorer.
 * Events do not carry the condition. The condition lives in the key file.
 */

export interface ClarificationAsk {
  question: string
  options?: Array<{ id: string; label: string }>
}

export interface OracleReply {
  /** Pre-written stakeholder text, or the fixed non-answer when nothing matches. */
  text: string
  matchedSlotIds: string[]
  unmatched: boolean
}

export type StudyCommitment = 'confirmed' | 'provisional'

export type StudyEventBody =
  | {
      type: 'clarification_asked'
      question: string
      options: Array<{ id: string; label: string }>
    }
  | {
      type: 'oracle_reply'
      matchedSlotIds: string[]
      unmatched: boolean
      replyChars: number
    }
  | {
      type: 'register_decision'
      question: string
      alternatives: Array<{ id: string; label: string }>
    }
  | {
      type: 'proposal'
      tool: string
      applied: boolean
      gateBlocked: boolean
      commitment: StudyCommitment
      impactElementIds: string[]
      text: string
    }
  | {
      /** In-loop decision-gate result. Copied from telemetry without the condition label. */
      type: 'decision_gate'
      allow: boolean
      disposition: string
      writePath: string
      elementIds: string[]
      decisionIds: string[]
    }
  | {
      type: 'final_hybrid'
      chars: number
      parserErrors: number
      parseOk: boolean
    }

export type StudyEvent = StudyEventBody & { seq: number }

export type StudyCondition = 'C1' | 'C2'
