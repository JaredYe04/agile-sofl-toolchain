/**
 * P5 — the deterministic SIMULATED-STAKEHOLDER ORACLE (task book §7.3 / preregistration §7.3).
 *
 * This is the experiment's actor: it stands in for the human stakeholder and answers the agent's
 * clarification questions. It is PURE (imports only p5task + the existing mulberry32) so it is
 * unit-testable without Electron, and it is the ONLY reader of a task's GOLD (referenceItems /
 * stakeholderProfile). The evaluated agent sees only question→response through this interface — it
 * never reads the scenario file (oracle isolation, prereg §7.2/§7.3, hard rule).
 *
 * §7.3 requirements, mapped:
 *   - distinguishes knows / does-not-know / refuses / defers        -> ItemPolicy (knows/unknown/refuse/defer)
 *   - fixed policy, gold never changes mid-interaction             -> reads the task once; answers are a pure
 *                                                                     function of (question, task, mode, seed, history)
 *   - irrelevant question -> unanswerable/refuse, NO auto-completion -> no-match => unmatched (a value is never
 *                                                                     invented; the harness maps unmatched to the
 *                                                                     UNMATCHED_CLARIFICATION_REPLY sentinel)
 *   - semantic-equivalent answers across phrasings                  -> bilingual keyword routing (English + 中文)
 *   - records every answer, basis, count, question type             -> records[] (the full interaction log)
 *   - deterministic AND seeded-random, seed-controlled             -> mode 'deterministic' | 'random' + mulberry32
 *
 * ANTI-FABRICATION (prereg §7.5): the oracle NEVER marks anything confirmed. It only SUPPLIES the
 * stakeholder's stance as plain text; recording that stance as a `simulated_user_answer` (never
 * `user_confirmed`) is the P4 layer's job (see requirementTools.recordHumanClarificationAnswer). The
 * non-knows stances are returned as bare terminal keywords so the P4 mapping maps them to the honest
 * decision kind and fabricates nothing.
 */
import { mulberry32 } from './schedule'
import type { P5Task, ReferenceItem } from './p5task'

/** The stakeholder's stance for a given question. */
export type OracleStance = 'knows' | 'unknown' | 'refuse' | 'defer'

export interface OracleConfig {
  /** 'deterministic' (default) returns the canonical answer; 'random' picks a seeded,
   *  semantic-equivalent phrasing (the VALUE is unchanged, only the surface varies). */
  mode?: 'deterministic' | 'random'
  /** Seeds the random variant (mulberry32). Ignored in deterministic mode. */
  seed?: number
}

/** One oracle answer (what the agent sees is `text` only; the rest is for the audit log / scorer). */
export interface OracleAnswer {
  /** The plain-text answer the harness sends back to the agent (the only gold-derived content exposed). */
  text: string
  /** The gold items this question was about (empty when unmatched/irrelevant). */
  matchedItemIds: string[]
  /** True when no reference item matched (an irrelevant question) — the agent must NOT invent a value. */
  unmatched: boolean
  /** The stakeholder's stance. */
  stance: OracleStance
  /** Why it answered this (for the audit log; e.g. matched keywords, or 'no item matched'). */
  basis: string
}

/** One entry in the full interaction log (prereg §7.3: record every answer, its basis, count, type). */
export interface OracleRecord {
  /** 1-based count of the question (every clarification routed to the oracle). */
  n: number
  question: string
  obligationId?: string
  answer: OracleAnswer
}

/** How the harness should map an unmatched oracle answer back to the loop (preserves the P4 sentinel). */
export const ORACLE_UNMATCHED =
  'No stakeholder decision is available for this question. Do not invent a concrete business value, ' +
  'default, threshold, or policy. Continue only with what is already stated, or ask a different, well-' +
  'defined question.'

interface Match {
  item: ReferenceItem
  /** Number of the item's keywords present in the question (0 = no match). */
  hits: number
  /** The specific keywords that hit (for the basis string). */
  hitKeywords: string[]
}

export class StakeholderOracle {
  private readonly task: P5Task
  private readonly mode: 'deterministic' | 'random'
  private readonly rnd: () => number
  private readonly records: OracleRecord[] = []
  private questions = 0

  constructor(task: P5Task, cfg: OracleConfig = {}) {
    this.task = task
    this.mode = cfg.mode ?? 'deterministic'
    // Deterministic mode uses a constant stream so repeated calls are reproducible; random uses the seed.
    this.rnd = mulberry32(cfg.mode === 'random' ? (cfg.seed ?? 0) : 1)
  }

  /** The full interaction log (read-only view). */
  get log(): readonly OracleRecord[] {
    return this.records
  }

  /** Total clarification questions routed to the oracle. */
  get questionCount(): number {
    return this.questions
  }

  /** How many times an already-answered item was asked again (the "redundant questions" cost metric,
   *  prereg §3.2). A method that re-asks a settled item is measured here. */
  get redundantQuestions(): number {
    let r = 0
    for (const rec of this.records) {
      for (const id of rec.answer.matchedItemIds) {
        if (rec.answer.matchedItemIds.length > 0 && this.wasAnsweredBefore(rec, id)) r++
      }
    }
    return r
  }

  private wasAnsweredBefore(rec: OracleRecord, itemId: string): boolean {
    // "Before this record": any earlier record already covered the item.
    return this.records.slice(0, rec.n - 1).some((e) => e.answer.matchedItemIds.includes(itemId))
  }

  /**
   * Answer a clarification question. PURE with respect to the task's gold (the task is read once);
   * state changes are limited to the interaction log. Returns the stance as plain text; the agent
   * never sees the gold item statements.
   */
  resolve(ask: { question: string; obligationId?: string }): OracleAnswer {
    this.questions++
    const q = (ask.question ?? '').toLowerCase()
    const matches = this.task.referenceItems
      .map((item) => scoreMatch(item, q))
      .filter((m) => m.hits > 0)

    let answer: OracleAnswer
    if (matches.length === 0) {
      // IRRELEVANT question: no gold item matches. Do NOT invent a value (no auto-completion).
      answer = {
        text: ORACLE_UNMATCHED,
        matchedItemIds: [],
        unmatched: true,
        stance: 'unknown',
        basis: 'no reference item matched this question (irrelevant / unanswerable)'
      }
    } else {
      // Best match: most keyword hits; deterministic tiebreak by reference order (first wins).
      matches.sort((a, b) => b.hits - a.hits || this.task.referenceItems.indexOf(a.item) - this.task.referenceItems.indexOf(b.item))
      const best = matches[0]
      const others = matches.slice(1).filter((m) => m.hits === best.hits)
      const item = best.item
      const stance: OracleStance = item.policy
      const kws = best.hitKeywords.join(', ')
      const also = others.map((m) => m.item.id).join(', ')
      const basis = 'matched ' + JSON.stringify(item.id) + ' via keyword(s) ' + JSON.stringify(kws) +
        (others.length ? '; also weakly matched ' + JSON.stringify(also) : '')
      answer = {
        text: this.phrase(item, stance),
        matchedItemIds: matches.map((m) => m.item.id),
        unmatched: false,
        stance,
        basis
      }
    }

    this.records.push({
      n: this.questions,
      question: ask.question ?? '',
      ...(ask.obligationId ? { obligationId: ask.obligationId } : {}),
      answer
    })
    return answer
  }

  /** The surface phrasing for a stance. Non-knows stances are BARE terminal keywords so the P4
   *  mapping maps them to the honest decision kind (unknown/defer/none_of_above) and fabricates
   *  nothing. 'knows' returns the concrete value (a real answer), with a seeded, semantic-equivalent
   *  phrasing in random mode. */
  private phrase(item: ReferenceItem, stance: OracleStance): string {
    if (stance === 'unknown') return 'unknown'
    if (stance === 'defer') return 'defer'
    if (stance === 'refuse') return 'none_of_above'
    // knows: the concrete value. Deterministic = the canonical answer; random = a seeded equivalent.
    if (this.mode !== 'random') return item.answer
    const r = this.rnd()
    if (r < 0.5) return item.answer
    if (r < 0.8) return 'Yes — ' + item.answer + '.'
    return 'Decided: ' + item.answer + '.'
  }
}

/** Score how strongly a reference item's keywords match a lowercased question. */
function scoreMatch(item: ReferenceItem, q: string): Match {
  const hitKeywords = item.keywords.filter((k) => {
    const kk = k.trim().toLowerCase()
    return kk.length > 0 && q.includes(kk)
  })
  return { item, hits: hitKeywords.length, hitKeywords }
}
