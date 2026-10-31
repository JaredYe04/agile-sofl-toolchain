/**
 * P5 — the DETERMINISTIC A/B/C/D method driver (frozen method definitions, prereg §2; smoke, prereg §8).
 *
 * This is the SMOKE's stand-in for the four evaluated methods. It reuses the FROZEN P3/P4 research core
 * (`RefinementSession` + the cost-aware `selectNext` selector) — it is NOT a second agent system (task
 * book §6.1). The evaluated "agent" in the smoke is a deterministic elicitation policy: each method asks
 * the same neutral, researcher-authored questions (derived from each item's `topicPhrase`, which mirrors
 * the open topics already named in `initialRoughStory`, so NO gold is exposed) and differs only in the
 * dimensions the pre-registration isolates:
 *
 *   A  free-form        no typed tree, no obligations, NO typed decision recorded (prose only)
 *   B  static tree      typed tree + typed obligations, questions in a FIXED static order (no ranking)
 *   C  adaptive         typed tree, NO semantic obligations, GENERIC (non-semantic) rank over the topics
 *   D  proposed         typed tree + typed SEMANTIC obligations + COST-AWARE selection (the real
 *                       RefinementSession.selectNextClarification) + provenance + readiness + propagation
 *   D-cost-aware        D but selection is FLAT (static order over the same typed obligations)
 *   D-propagation       D but cross-node propagation is disabled (never supersedes)
 *   D-obligations       D but NO typed obligations (cost-aware rank over the typed tree, no obligation signal)
 *
 * ORACLE ISOLATION: the driver, like the evaluated agent, sees ONLY question→response through the
 * `StakeholderOracle`. It never reads a task's reference-item `answer`/`statement`/`keywords` except the
 * neutral `topicPhrase` (visible metadata) used to WORD the questions. The concrete value in the final
 * spec always comes from the oracle's returned text. `scoreRun` (the auditor) is the only gold reader.
 *
 * SMOKE ROLE (prereg §8): the SMOKE runs this driver with ALL MOCKS (no LLM) for 1 scenario × 1 seed ×
 * every main group, then validates the interaction logs + `scoreRun`. In P6 the same driver shape is
 * driven by the real LLM through `core.ts` (LLM-generated questions); the mock here exists to validate
 * the pipeline deterministically before any API spend. The mock's question ORDER is a deterministic
 * stand-in, not a real cost measurement — the true effort comparison is made in P6.
 */
import { RefinementSession, deterministicIdGen, type DecisionAnswer } from '@agile-sofl/refinement'
import type { P5Task, ReferenceItem } from './p5task'
import { StakeholderOracle, ORACLE_UNMATCHED, type OracleAnswer } from './oracle'
import type { RunArtifacts, RecordedDecisionRef } from './scorer'

export type MethodId = 'A' | 'B' | 'C' | 'D' | 'D-cost-aware' | 'D-propagation' | 'D-obligations'

/** How a method orders / selects its questions (the RQ3 ablation knobs live here). */
type Selection = 'static' | 'generic' | 'cost-aware'

/** The frozen mechanism profile of a method (prereg §2). The smoke exercises exactly these flags. */
interface MethodProfile {
  id: MethodId
  /** Build the typed requirement tree (B/C/D/* all do; A is free-form and does not). */
  usesTypedTree: boolean
  /** Open TYPED SEMANTIC obligations and select over them (the D contribution). */
  usesObligations: boolean
  /** Question-ordering policy: static (fixed order) / generic (non-semantic rank) / cost-aware (the real selector). */
  selection: Selection
  /** Whether the method records typed decisions with honest provenance (A does not — free-form prose only). */
  recordsTypedDecision: boolean
  /** Whether cross-node decision propagation (supersession) is enabled (D / D-cost-aware; off in D-propagation). */
  usesPropagation: boolean
}

/** The seven frozen method configurations (prereg §2 + the three single-component ablations). */
export const METHOD_PROFILES: Record<MethodId, MethodProfile> = {
  'A':              { id: 'A',             usesTypedTree: false, usesObligations: false, selection: 'static',     recordsTypedDecision: false, usesPropagation: false },
  'B':              { id: 'B',             usesTypedTree: true,  usesObligations: true,  selection: 'static',     recordsTypedDecision: true,  usesPropagation: false },
  'C':              { id: 'C',             usesTypedTree: true,  usesObligations: false, selection: 'generic',    recordsTypedDecision: true,  usesPropagation: false },
  'D':              { id: 'D',             usesTypedTree: true,  usesObligations: true,  selection: 'cost-aware', recordsTypedDecision: true,  usesPropagation: true },
  'D-cost-aware':   { id: 'D-cost-aware',  usesTypedTree: true,  usesObligations: true,  selection: 'static',     recordsTypedDecision: true,  usesPropagation: true },
  'D-propagation':  { id: 'D-propagation', usesTypedTree: true,  usesObligations: true,  selection: 'cost-aware', recordsTypedDecision: true,  usesPropagation: false },
  'D-obligations':  { id: 'D-obligations', usesTypedTree: true,  usesObligations: false, selection: 'cost-aware', recordsTypedDecision: true,  usesPropagation: false }
}

export const ALL_METHODS: MethodId[] = ['A', 'B', 'C', 'D', 'D-cost-aware', 'D-propagation', 'D-obligations']

export interface RunMethodOptions {
  seed: number
  /** Oracle surface mode. 'deterministic' (default) returns canonical values; 'random' = seeded rephrasing. */
  oracleMode?: 'deterministic' | 'random'
  /** Optional cap on clarification questions (a stakeholder-effort budget). Omitted = ask all open items. */
  maxQuestions?: number
}

/** One question the method asked, as routed to the oracle (the interaction log the smoke validates). */
export interface QuestionTrace {
  itemId: string
  question: string
  matchedItemIds: string[]
  unmatched: boolean
  stance: OracleAnswer['stance']
}

/** A method run's artifacts + its interaction log (the log is extra metadata for the smoke validation). */
export interface MethodRun {
  artifacts: RunArtifacts
  /** The ordered questions asked + the oracle's matched item / stance for each (validates oracle routing). */
  trace: QuestionTrace[]
  /** The mechanism flags that were exercised (asserted by the gate test to prove the ablation wiring). */
  profile: MethodProfile
}

// ---- question wording (neutral; from topicPhrase only — never the gold value) ---------------

/** Word a clarification question for a topic. The lead-in adds no item keywords, so the oracle routes on
 *  the topicPhrase alone (which mirrors a topic already named in `initialRoughStory`). */
export function questionFor(item: ReferenceItem): string {
  return 'Regarding ' + item.topicPhrase + ', what is the decision?'
}

// ---- deterministic session ---------------------------------------------------------------

/** A fresh, fully deterministic session (injectable clock + id generators => reproducible per seed). */
function buildSession(seed: number): RefinementSession {
  let t = 1_000_000 + seed
  const now = () => t++
  const base = 1_000_000 * (seed + 1)
  return new RefinementSession({
    idGen: deterministicIdGen('rn', base),
    obligationIdGen: deterministicIdGen('ob', base + 1),
    decisionIdGen: deterministicIdGen('dec', base + 2),
    readinessIdGen: deterministicIdGen('rd', base + 3),
    now
  })
}

// ---- structure seeding ---------------------------------------------------------------------

interface Seeded {
  rootId: string
  nodeById: Map<string, string> // itemId -> nodeId
}

/** Add the root goal + one typed node per reference topic (from the neutral topicPhrase). */
function seedStructure(task: P5Task, session: RefinementSession, profile: MethodProfile): Seeded {
  if (!profile.usesTypedTree) return { rootId: '', nodeById: new Map() }
  const root = session.graph.addNode({
    nodeType: 'system_goal',
    title: task.domain + ' system',
    description: task.initialRoughStory,
    scope: 'project',
    source: 'source_text_observation'
  })
  const nodeById = new Map<string, string>()
  task.referenceItems.forEach((item, i) => {
    const node = session.graph.addNode({
      nodeType: 'capability',
      title: item.topicPhrase,
      description: item.topicPhrase,
      scope: 'project',
      parentId: root.id,
      ordering: i,
      criticality: item.critical ? 0.9 : item.policyDecision ? 0.7 : 0.4,
      source: 'AI_hypothesis'
    })
    nodeById.set(item.id, node.id)
  })
  return { rootId: root.id, nodeById }
}

// ---- typed semantic obligations (the D contribution) --------------------------------------

interface ObligationMap {
  obligationById: Map<string, string> // itemId -> obligationId
}

/** Open one typed obligation per reference topic. The obligation description IS the clarification
 *  question (worded from the neutral topicPhrase), so the oracle routes it back to the same item. */
function openObligations(task: P5Task, session: RefinementSession, seeded: Seeded): ObligationMap {
  const obligationById = new Map<string, string>()
  for (const item of task.referenceItems) {
    const nodeId = seeded.nodeById.get(item.id)
    if (!nodeId) continue
    const spec = obligationSpecFor(item)
    const ob = session.engine.open({
      nodeId,
      kind: spec.kind,
      description: questionFor(item),
      severity: spec.severity,
      policyRequired: spec.policyRequired
    })
    obligationById.set(item.id, ob.id)
  }
  return { obligationById }
}

/** Map a reference item's frozen semantic flags to a typed obligation kind + severity. The KIND
 *  determines detectorClass + the auto `policyRequired` flag (policy_confirmation is the high-impact,
 *  min-risk-gated kind); the SEVERITY reflects the item's importance for the quality floor so the
 *  cost-aware selector prioritizes what the floor actually measures (critical coverage + policy). */
function obligationSpecFor(item: ReferenceItem): { kind: string; severity: 'critical' | 'major' | 'minor'; policyRequired?: boolean } {
  const severity: 'critical' | 'major' | 'minor' = item.critical || item.policyDecision ? 'critical' : item.mustHave ? 'major' : 'minor'
  if (item.policyDecision) return { kind: 'policy_confirmation', severity, policyRequired: true }
  return { kind: 'boundary_condition', severity }
}

// ---- answer mapping ------------------------------------------------------------------------

/** How a stakeholder stance maps to a typed DecisionAnswer (the P4 recording seam). */
function stanceToDecisionAnswer(ans: OracleAnswer): DecisionAnswer {
  if (ans.stance === 'knows') return { kind: 'answer', answer: ans.text }
  if (ans.stance === 'defer') return { kind: 'defer', answer: ans.text }
  if (ans.stance === 'refuse') return { kind: 'none_of_above', answer: ans.text }
  return { kind: 'unknown', answer: ans.text } // 'unknown'
}

/** The honest provenance a stance records under for a method that records via the raw store (no
 *  obligation to drive the typed recordDecision mapping). knows -> a real simulated answer; the
 *  non-knows stances leave no value -> 'deferred'. Both are legal `ProvenanceStatus` members, so the
 *  result is directly assignable (no cast) and the store's anti-fabrication check (which rejects only
 *  'AI_hypothesis') passes. */
function stanceToProvenance(stance: OracleAnswer['stance']): 'simulated_user_answer' | 'deferred' {
  return stance === 'knows' ? 'simulated_user_answer' : 'deferred'
}

// ---- question ordering (the ablation knob) -------------------------------------------------

/** Static / generic orderings over the topic ids. 'cost-aware' is handled dynamically by the selector
 *  (or, without obligations, by a criticality rank over the typed tree — no obligation signal). */
function orderedItemIds(task: P5Task, profile: MethodProfile): string[] {
  const ids = task.referenceItems.map((i) => i.id)
  const kwCount = (id: string) => (task.referenceItems.find((i) => i.id === id)?.keywords.length ?? 0)
  // A numeric importance score derived from the item's boolean flags (the tree's criticality signal —
  // this is what the typed tree carries, NOT the obligation signal that D adds on top).
  const crit = (id: string) => {
    const it = task.referenceItems.find((i) => i.id === id)
    if (!it) return 0
    let s = 0
    if (it.critical) s += 2
    if (it.policyDecision) s += 1.5
    if (it.mustHave) s += 1
    return s
  }
  if (profile.selection === 'generic') {
    // A GENERIC (non-semantic) rank: specificity proxy = more keywords first, tie -> reference order.
    // Deliberately does NOT look at the critical / policyDecision flags (that would be the D signal).
    return [...ids].sort((a, b) => kwCount(b) - kwCount(a) || ids.indexOf(a) - ids.indexOf(b))
  }
  if (profile.selection === 'cost-aware') {
    // D-obligations: cost-aware rank over the TYPED TREE (criticality desc, tie -> reference order),
    // with NO obligation signal — the typed structure is kept, the semantic obligations are removed.
    return [...ids].sort((a, b) => crit(b) - crit(a) || ids.indexOf(a) - ids.indexOf(b))
  }
  return ids // 'static': the fixed reference order (B / D-cost-aware / A)
}

// ---- the run loop ---------------------------------------------------------------------------

/** Record one resolved answer for a method (or nothing, for free-form A). */
function recordAnswer(
  session: RefinementSession,
  profile: MethodProfile,
  itemId: string,
  question: string,
  ans: OracleAnswer,
  seeded: Seeded,
  obligations: ObligationMap | null
): void {
  if (!profile.recordsTypedDecision) return // free-form A: prose only, no typed decision
  if (profile.usesObligations && obligations) {
    const oid = obligations.obligationById.get(itemId)
    if (oid) session.recordDecision({ obligationId: oid, answer: stanceToDecisionAnswer(ans), actorKind: 'simulated_user' })
  } else {
    const nid = seeded.nodeById.get(itemId)
    session.store.record({
      question,
      answer: ans.text,
      actorKind: 'simulated_user',
      provenance: stanceToProvenance(ans.stance),
      targetNodeIds: nid ? [nid] : [],
      obligationIds: []
    })
  }
}

/** Build the final spec text from the resolved answers (the value always comes from the oracle text). */
function buildFinalSpec(resolved: Array<{ itemId: string; stance: string; text: string; topicPhrase: string }>): string {
  const lines: string[] = []
  for (const r of resolved) {
    if (r.stance === 'knows') lines.push('The specification states that ' + r.topicPhrase + ': ' + r.text + '.')
    else lines.push(cap(r.topicPhrase) + ' is left open (stakeholder: ' + r.text + ').')
  }
  return lines.join('\n')
}

function cap(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Run one method on one task (the deterministic mock driver). Returns the scorer's RunArtifacts plus
 * the interaction log + the profile that was exercised. Pure with respect to the task gold: the only
 * gold-derived content that reaches the output is the oracle's returned answer text.
 */
export function runMethod(methodId: MethodId, task: P5Task, opts: RunMethodOptions): MethodRun {
  const profile = METHOD_PROFILES[methodId]
  const oracle = new StakeholderOracle(task, { mode: opts.oracleMode ?? 'deterministic', seed: opts.seed })
  const session = buildSession(opts.seed)
  const seeded = seedStructure(task, session, profile)
  const obligations = profile.usesObligations ? openObligations(task, session, seeded) : null

  const trace: QuestionTrace[] = []
  const resolved: Array<{ itemId: string; stance: string; text: string; topicPhrase: string }> = []
  const ask = (itemId: string, question: string): void => {
    const item = task.referenceItems.find((i) => i.id === itemId)
    if (!item) return
    const ans = oracle.resolve({ question })
    trace.push({ itemId, question, matchedItemIds: ans.matchedItemIds, unmatched: ans.unmatched, stance: ans.stance })
    if (ans.unmatched || ans.text === ORACLE_UNMATCHED) return // irrelevant question -> do NOT invent a value
    recordAnswer(session, profile, itemId, question, ans, seeded, obligations)
    resolved.push({ itemId, stance: ans.stance, text: ans.text, topicPhrase: item.topicPhrase })
  }

  if (profile.selection === 'cost-aware' && obligations) {
    // D / D-propagation: the real cost-aware selector over the typed obligations, one best-per-turn.
    // (The selector excludes already-answered obligations, so it naturally stops after all are resolved.)
    let budget = opts.maxQuestions
    for (let guard = 0; guard < task.referenceItems.length + 2; guard++) {
      if (budget !== undefined && budget <= 0) break
      const next = session.selectNextClarification({ stage: 'p5-smoke', ...(budget !== undefined ? { budgetRemaining: budget } : {}) })
      if (!next) break
      const itemId = reverseLookup(obligations, next.obligationId) ?? next.obligationId
      ask(itemId, next.question)
      if (budget !== undefined) budget--
    }
  } else {
    // A / B / C / D-cost-aware / D-obligations: a precomputed (static / generic / tree-cost-aware) order.
    for (const itemId of orderedItemIds(task, profile)) {
      if (opts.maxQuestions !== undefined && resolved.length >= opts.maxQuestions) break
      const item = task.referenceItems.find((i) => i.id === itemId)
      ask(itemId, questionFor(item!))
    }
  }

  const finalSpec = buildFinalSpec(resolved)
  const decisions: RecordedDecisionRef[] = session.store.active().map((d) => ({
    answer: d.answer,
    provenance: d.provenance,
    status: d.status,
    question: d.question
  }))
  const stakeholderWords = oracle.log.reduce((n, r) => n + (r.answer.text ? r.answer.text.split(/\s+/).filter(Boolean).length : 0), 0)

  const artifacts: RunArtifacts = {
    method: methodId,
    taskId: task.id,
    seed: opts.seed,
    finalSpec,
    decisions,
    questions: oracle.questionCount,
    redundantQuestions: oracle.redundantQuestions,
    stakeholderWords,
    ruleBasedContradictions: 0,
    traceabilityEdges: []
  }
  return { artifacts, trace, profile }
}

/** obligationId -> itemId (for the cost-aware loop, which hands back an obligation id). */
function reverseLookup(obligations: ObligationMap, obligationId: string): string | null {
  for (const [itemId, oid] of obligations.obligationById) if (oid === obligationId) return itemId
  return null
}
