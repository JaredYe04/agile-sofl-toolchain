/**
 * Scripted stakeholder for Study A.
 * Answers only from the gold package for the scenario. The function does not take a condition,
 * a model id, or the DASR flag. Callers must not put those in the question text.
 */
import type { ClarificationAsk, OracleReply } from './studyATypes'
import type { GoldPackage, GoldSlot } from './studyAGoldTypes'

export const ORACLE_PROTOCOL = 'study-a-oracle-1'

/** Fixed reply when a question hits no gold slot. It authorizes no business rule. */
export const UNMATCHED_ORACLE_REPLY =
  'No pre-written decision for this scenario matches this question. No business rule is authorized by this reply.'

export function normalizeMatchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function askText(ask: { question: string; options?: Array<{ label?: string }> }): string {
  const labels = (ask.options ?? []).map((option) => option.label ?? '').join('\n')
  return `${ask.question}\n${labels}`
}

/** Gold slots whose matchTerms appear in `text`. Order follows the gold package. */
export function matchSlots(gold: GoldPackage, text: string): string[] {
  const haystack = normalizeMatchText(text)
  if (!haystack) return []
  return gold.unresolvedSlots
    .filter((slot) => slot.matchTerms.some((term) => haystack.includes(normalizeMatchText(term))))
    .map((slot) => slot.id)
}

function slotById(gold: GoldPackage, id: string): GoldSlot | undefined {
  return gold.unresolvedSlots.find((slot) => slot.id === id)
}

/**
 * Stakeholder reply for one clarification. `gold` is the scenario package.
 * There is no condition argument.
 */
export function answerFromGold(gold: GoldPackage, ask: ClarificationAsk): OracleReply {
  const matchedSlotIds = matchSlots(gold, askText(ask))
  if (matchedSlotIds.length === 0) {
    return { text: UNMATCHED_ORACLE_REPLY, matchedSlotIds: [], unmatched: true }
  }
  const text = matchedSlotIds
    .map((id) => slotById(gold, id)?.stakeholderAnswer ?? '')
    .filter(Boolean)
    .join('\n')
  return { text, matchedSlotIds, unmatched: false }
}

export function createStakeholderOracle(gold: GoldPackage): (ask: ClarificationAsk) => OracleReply {
  return (ask) => answerFromGold(gold, ask)
}
