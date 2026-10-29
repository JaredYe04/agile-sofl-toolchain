import { UNMATCHED_CLARIFICATION_REPLY, type ClarificationAsk, type ClarificationResolution } from '../agent-harness/core'
import type { AuthorizedFact } from './types'

function haystack(ask: ClarificationAsk): string {
  return `${ask.question} ${(ask.options ?? []).map((o) => `${o.id} ${o.label}`).join(' ')}`.toLowerCase()
}

function uniqueFacts(facts: AuthorizedFact[]): AuthorizedFact[] {
  const seen = new Set<string>()
  const out: AuthorizedFact[] = []
  for (const f of facts) {
    if (seen.has(f.id)) continue
    seen.add(f.id)
    out.push(f)
  }
  return out
}

/**
 * Map ask_clarification onto task-packet facts only.
 * ≥1 keyword/option hits are all accepted and concatenated — a question that
 * names several domains (e.g. 场景图/资源/主循环) must not become unmatched.
 * Zero hits → unmatched reply; never invent a stakeholder opinion.
 */
export function resolveFromFacts(facts: AuthorizedFact[]): (ask: ClarificationAsk) => ClarificationResolution {
  return (ask) => {
    const q = haystack(ask)
    const hits: AuthorizedFact[] = []
    for (const f of facts) {
      if (f.keywords.some((k) => k && q.includes(k.toLowerCase()))) hits.push(f)
      else if (ask.options?.some((o) => (o.label && f.text.includes(o.label)) || (o.id && f.id === o.id))) {
        hits.push(f)
      }
    }
    const unique = uniqueFacts(hits)
    if (unique.length >= 1) {
      return {
        text: unique.map((f) => f.text).join('\n'),
        matchedSlotIds: unique.map((f) => f.id),
        unmatched: false
      }
    }
    return { text: UNMATCHED_CLARIFICATION_REPLY, unmatched: true }
  }
}
