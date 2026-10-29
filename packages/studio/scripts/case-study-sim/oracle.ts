import { UNMATCHED_CLARIFICATION_REPLY, type ClarificationAsk, type ClarificationResolution } from '../agent-harness/core'
import type { AuthorizedFact } from './types'

/**
 * Map ask_clarification onto task-packet facts only. Unmatched questions get the
 * harness unmatched reply — never a fabricated stakeholder opinion.
 */
export function resolveFromFacts(facts: AuthorizedFact[]): (ask: ClarificationAsk) => ClarificationResolution {
  return (ask) => {
    const q = `${ask.question} ${(ask.options ?? []).map((o) => o.label).join(' ')}`.toLowerCase()
    const hits = facts.filter((f) => f.keywords.some((k) => k && q.includes(k.toLowerCase())))
    if (hits.length === 1) {
      return { text: hits[0]!.text, matchedSlotIds: [hits[0]!.id], unmatched: false }
    }
    if (ask.options?.length) {
      const byLabel = facts.filter((f) =>
        ask.options!.some((o) => o.label && f.text.includes(o.label))
      )
      if (byLabel.length === 1) {
        return { text: byLabel[0]!.text, matchedSlotIds: [byLabel[0]!.id], unmatched: false }
      }
    }
    return { text: UNMATCHED_CLARIFICATION_REPLY, unmatched: true }
  }
}
