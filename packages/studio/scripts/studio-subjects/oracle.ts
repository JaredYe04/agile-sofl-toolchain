import type { AuthorizedFact } from './types'

export type ClarificationAsk = {
  question: string
  options?: Array<{ id: string; label: string }>
  multiSelect?: boolean
  allowCustom?: boolean
}

export type ClarificationResolution = {
  text: string
  matchedSlotIds?: string[]
  unmatched?: boolean
}

/** Same rule as the headless harness: never invent a stakeholder decision. */
export const UNMATCHED_CLARIFICATION_REPLY =
  'No additional stakeholder decision is available from this automated reply. Do not invent concrete business defaults, thresholds, role scopes, permission policies, or capacity limits. If a stakeholder choice is still required, call ask_clarification again; otherwise continue only with requirements already stated in the task.'

function haystack(ask: ClarificationAsk): string {
  return `${ask.question} ${(ask.options ?? []).map((o) => `${o.id} ${o.label}`).join(' ')}`.toLowerCase()
}

/**
 * Map ask_clarification onto task-packet facts only.
 * One or more keyword hits are concatenated. Zero hits stay unmatched.
 */
export function resolveFromFacts(facts: AuthorizedFact[]): (ask: ClarificationAsk) => ClarificationResolution {
  return (ask) => {
    const q = haystack(ask)
    const hits: AuthorizedFact[] = []
    const seen = new Set<string>()
    for (const fact of facts) {
      const keywordHit = fact.keywords.some((keyword) => keyword && q.includes(keyword.toLowerCase()))
      const optionHit = ask.options?.some((option) => (option.label && fact.text.includes(option.label)) || option.id === fact.id)
      if ((keywordHit || optionHit) && !seen.has(fact.id)) {
        seen.add(fact.id)
        hits.push(fact)
      }
    }
    if (hits.length >= 1) {
      return {
        text: hits.map((fact) => fact.text).join('\n'),
        matchedSlotIds: hits.map((fact) => fact.id),
        unmatched: false
      }
    }
    return { text: UNMATCHED_CLARIFICATION_REPLY, unmatched: true }
  }
}
