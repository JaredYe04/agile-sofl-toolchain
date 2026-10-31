import { describe, expect, it } from 'vitest'
import { RefinementSession, deterministicIdGen } from '@agile-sofl/refinement'
import {
  runRequirementTool,
  requirementToolAllowed,
  recordHumanClarificationAnswer,
  clarificationAnswerToDecision,
  REQUIREMENT_TOOL_NAMES
} from '../src/main/services/llm/requirementTools'

/**
 * P4 — the THIN Studio requirement-layer surface (task book §6.1: "do not create a second agent
 * system"; these are one typed call into `RefinementSession`, which the agent loop persists per
 * project). `requirementTools.ts` is pure (no fs / Electron), so it is unit-testable here without
 * mocking Electron. These tests pin the contract the agent loop dispatches on — and, critically,
 * the ANTI-FABRICATION rule of task book §6.1 ("record_decision 不能由 Agent 假扮用户直接调用；实验中
 * 必须明确使用经过隔离的 simulator actor"):
 *   - read/list/select/assess are read-only (mutated=false) and the ONLY tools the LLM may call,
 *   - `record_decision` is NOT an agent tool: a stray call is refused, never acted on,
 *   - a stakeholder decision reaches the session only via `recordHumanClarificationAnswer`, driven
 *     by the HUMAN's actual answer (option click / typed text in the Studio UI, or the isolated
 *     oracle's plain-text answer in the experiment harness) — the model never supplies the answer,
 *   - the cost-aware selector never re-asks an answered obligation,
 *   - `unknown` / a bare answer fabricates nothing (obligation stays open, node not promoted),
 *   - a real `user` confirm is stamped `user_confirmed`; the ISOLATED `simulated_user` oracle
 *     confirms are stamped `simulated_user_answer` and can NEVER launder into `user_confirmed`.
 */
const NOW = () => 1

function mkSession(): RefinementSession {
  return new RefinementSession({
    idGen: deterministicIdGen('rn'),
    obligationIdGen: deterministicIdGen('ob'),
    decisionIdGen: deterministicIdGen('dec'),
    readinessIdGen: deterministicIdGen('rdy'),
    now: NOW
  })
}

/** A two-capability scope, each with an open policy obligation (the common refinement situation). */
function scopeWithTwoPolicies(): { s: RefinementSession; capA: string; capB: string; oA: string; oB: string } {
  const s = mkSession()
  const root = s.graph.addNode({ nodeType: 'system_goal', title: 'Reserve a seat', description: 'd', scope: 'booking' })
  const [capA, capB] = s.proposeRefinement(root.id, [
    { nodeType: 'capability', title: 'Seat availability', description: 'd' },
    { nodeType: 'capability', title: 'Seat role policy', description: 'd' }
  ])
  const oA = s.engine.open({ nodeId: capA, kind: 'policy_confirmation', description: 'confirm availability rule' })
  const oB = s.engine.open({ nodeId: capB, kind: 'role_permission', description: 'confirm seat role policy' })
  return { s, capA, capB, oA: oA.id, oB: oB.id }
}

describe('requirementTools (thin Studio wrappers over RefinementSession)', () => {
  it('read_requirement_graph returns nodes, links, counts, docVersion and a readiness preview (read-only)', () => {
    const { s, capA, capB } = scopeWithTwoPolicies()
    const r = runRequirementTool(s, 'read_requirement_graph', { scope: 'booking', includeLinks: true })
    expect(r.ok).toBe(true)
    expect(r.mutated).toBe(false)
    expect(r.content.ok).toBe(true)
    const c = r.content as Record<string, any>
    // 1 root + 2 capabilities = 3 nodes; 2 refines edges.
    expect(c.counts.nodes).toBe(3)
    expect(c.counts.edges).toBe(2)
    expect(c.nodes.map((n: any) => n.id).sort()).toEqual([capA, capB, s.graph.allNodes().find((n) => !n.parentId)!.id].sort())
    expect(c.docVersion).toBe(s.docVersion)
    expect(typeof c.verdictPreview).toBe('string')
  })

  it('list_obligations returns open obligations with detector class + the high-impact policy set (read-only)', () => {
    const { s, oA, oB } = scopeWithTwoPolicies()
    const r = runRequirementTool(s, 'list_obligations', {})
    expect(r.ok).toBe(true)
    expect(r.mutated).toBe(false)
    const c = r.content as Record<string, any>
    expect(c.count).toBe(2)
    expect(c.obligations.map((o: any) => o.id).sort()).toEqual([oA, oB].sort())
    expect(c.obligations.every((o: any) => o.detectorClass === 'user_decision')).toBe(true)
    // Both policy obligations are high-impact (policyRequired + critical) and thus gated.
    expect(c.highImpact.sort()).toEqual([oA, oB].sort())
  })

  it('select_next_clarification returns the top cost-aware question with an option set, then never re-asks it', () => {
    const { s } = scopeWithTwoPolicies()
    const r1 = runRequirementTool(s, 'select_next_clarification', { budgetRemaining: 5 })
    expect(r1.ok).toBe(true)
    expect(r1.mutated).toBe(false)
    const n1 = (r1.content as any).next
    expect(n1).not.toBeNull()
    expect(typeof n1.question).toBe('string')
    expect(Array.isArray(n1.options)).toBe(true)
    expect(n1.options).toContain('unknown')
    expect(n1.options).toContain('defer')
    const firstId = n1.obligationId

    // The stakeholder answers (a real user) — recorded from the HUMAN's answer, not the model.
    const pick = recordHumanClarificationAnswer(s, firstId, { selectedLabels: ['confirm'], custom: 'ok' })
    expect(pick.ok).toBe(true)
    expect(pick.mutated).toBe(true)

    // The next selection is the OTHER obligation (the answered one is never re-asked).
    const r2 = runRequirementTool(s, 'select_next_clarification', { budgetRemaining: 5 })
    expect((r2.content as any).next.obligationId).not.toBe(firstId)

    // Answer it `unknown` (a recorded answer): now NOTHING is eligible to re-ask.
    recordHumanClarificationAnswer(s, (r2.content as any).next.obligationId, { selectedLabels: ['unknown'] })
    const r3 = runRequirementTool(s, 'select_next_clarification', { budgetRemaining: 5 })
    expect((r3.content as any).next).toBeNull()
    expect(r3.mutated).toBe(false)
  })

  it('a real user confirm discharges, promotes the node, and stamps an HONEST user_confirmed source (mutated=true)', () => {
    const { s, capA, oA } = scopeWithTwoPolicies()
    const r = recordHumanClarificationAnswer(s, oA, { selectedLabels: ['confirm'], custom: 'always available' })
    expect(r.ok).toBe(true)
    expect(r.mutated).toBe(true)
    const c = r.content as Record<string, any>
    expect(c.discharged).toContain(oA)
    expect(c.promoted).toContain(capA)
    expect(c.fabricated).toBe(false)
    expect(c.recordedFrom).toBe('human_clarification_answer')
    // The node is ready and its source is a real-user confirmation (never a guess).
    expect(s.graph.getNode(capA)?.status).toBe('ready')
    expect(s.graph.getNode(capA)?.source).toBe('user_confirmed')
  })

  it('a plain-text concrete answer (harness/oracle path) is treated as an answer, not a keyword', () => {
    const { s, capA, oA } = scopeWithTwoPolicies()
    // The experiment oracle answers in plain text (no clicked option). A real value is an answer.
    const r = recordHumanClarificationAnswer(s, oA, { custom: 'seats are always available to all roles' })
    expect(r.ok).toBe(true)
    expect(r.mutated).toBe(true)
    const c = r.content as Record<string, any>
    expect(c.answer).toBe('answer')
    expect(c.discharged).toContain(oA)
    expect(c.promoted).toContain(capA)
    expect(s.graph.getNode(capA)?.source).toBe('user_confirmed')
  })

  it('an `unknown` answer fabricates nothing (obligation stays open, node not promoted, fabricated=false)', () => {
    const { s, capB, oB } = scopeWithTwoPolicies()
    const r = recordHumanClarificationAnswer(s, oB, { selectedLabels: ['unknown'] })
    expect(r.ok).toBe(true)
    expect(r.mutated).toBe(true)
    const c = r.content as Record<string, any>
    expect(c.discharged).toEqual([])
    expect(c.promoted).toEqual([])
    expect(c.fabricated).toBe(false)
    // Risk preserved: the obligation is still open and the node is still an unconfirmed draft.
    expect(s.engine.get(oB)?.status).toBe('open')
    expect(s.graph.getNode(capB)?.source).toBe('AI_hypothesis')
    expect(s.graph.getNode(capB)?.status).toBe('draft')
  })

  it('a plain-text `unknown` keyword (harness path) also fabricates nothing', () => {
    const { s, capB, oB } = scopeWithTwoPolicies()
    const r = recordHumanClarificationAnswer(s, oB, { custom: 'unknown' })
    expect(r.ok).toBe(true)
    expect((r.content as any).answer).toBe('unknown')
    expect((r.content as any).discharged).toEqual([])
    expect((r.content as any).promoted).toEqual([])
    expect(s.engine.get(oB)?.status).toBe('open')
    expect(s.graph.getNode(capB)?.source).toBe('AI_hypothesis')
  })

  it('record_decision is NOT an agent tool: a stray LLM call is refused and nothing is recorded', () => {
    const { s, oA } = scopeWithTwoPolicies()
    const r = runRequirementTool(s, 'record_decision', {
      obligationId: oA,
      answer: { kind: 'confirm', answer: 'ok' }
    })
    expect(r.ok).toBe(false)
    expect(r.mutated).toBe(false)
    expect(String((r.content as any).error)).toMatch(/not an agent tool/)
    // The obligation was NOT discharged by the refused call — the model cannot impersonate the user.
    expect(s.engine.get(oA)?.status).toBe('open')
  })

  it('the ISOLATED simulated_user oracle confirms, but can NEVER stamp a confirmed source (no laundering)', () => {
    const { s, capA, oA } = scopeWithTwoPolicies()
    // The experiment harness drives the session with the isolated simulator actor (P5). A confirm
    // discharges and advances the node, but the source is the HONEST simulated provenance.
    const r = recordHumanClarificationAnswer(s, oA, { selectedLabels: ['confirm'], custom: 'ok' }, 'simulated_user')
    expect(r.ok).toBe(true)
    expect(r.mutated).toBe(true)
    const c = r.content as Record<string, any>
    expect(c.recordedFrom).toBe('simulated_oracle_answer')
    expect(c.actor).toBe('simulated_user')
    expect(c.discharged).toContain(oA)
    expect(c.promoted).toContain(capA)
    // Anti-fabrication: the source is simulated_user_answer, NEVER user_confirmed/analyst_approved,
    // and the structural tripwire (fabricated) stays false.
    expect(s.graph.getNode(capA)?.source).toBe('simulated_user_answer')
    expect(s.graph.getNode(capA)?.source).not.toBe('user_confirmed')
    expect(c.fabricated).toBe(false)
  })

  it('assess_readiness returns a verdict with reason and the unresolved critical set (read-only)', () => {
    const { s } = scopeWithTwoPolicies()
    const r = runRequirementTool(s, 'assess_readiness', { scope: 'booking', targetStage: 'impl' })
    expect(r.ok).toBe(true)
    expect(r.mutated).toBe(false)
    const c = r.content as Record<string, any>
    expect(c.verdict).toBe('NEEDS_CLARIFICATION')
    expect(Array.isArray(c.unresolvedCriticalObligations)).toBe(true)
    expect(c.unresolvedCriticalObligations.length).toBe(2)
    expect(typeof c.reason).toBe('string')
  })

  it('an unknown tool name is not-ok (the loop treats it as a tool error)', () => {
    const { s } = scopeWithTwoPolicies()
    const r = runRequirementTool(s, 'not_a_requirement_tool', {})
    expect(r.ok).toBe(false)
    expect(r.mutated).toBe(false)
  })

  it('permission gate: all four LLM-callable tools are reads (need hybrid.read); record_decision absent', () => {
    const read = { hybrid: { read: true, write: false } }
    const writeOnly = { hybrid: { read: false, write: true } }
    for (const name of REQUIREMENT_TOOL_NAMES) {
      expect(requirementToolAllowed(name, read)).toBe(true)
      // None of the LLM-callable tools is a write — decisions are not tool calls.
      expect(requirementToolAllowed(name, writeOnly)).toBe(false)
    }
    // Exactly the four read/assess tools are exposed; record_decision is deliberately absent.
    expect([...REQUIREMENT_TOOL_NAMES].sort()).toEqual(
      ['assess_readiness', 'list_obligations', 'read_requirement_graph', 'select_next_clarification'].sort()
    )
    expect(REQUIREMENT_TOOL_NAMES).toHaveLength(4)
    expect((REQUIREMENT_TOOL_NAMES as readonly string[]).includes('record_decision')).toBe(false)
  })
})

describe('clarificationAnswerToDecision (pure mapping of a human answer to a DecisionAnswer)', () => {
  it('a clicked confirm with a typed value is a concrete `answer` (not a bare yes)', () => {
    expect(clarificationAnswerToDecision({ selectedLabels: ['confirm'], custom: '10% tax' }).kind).toBe('answer')
  })

  it('a bare clicked confirm (no text) is a `confirm`', () => {
    expect(clarificationAnswerToDecision({ selectedLabels: ['confirm'] }).kind).toBe('confirm')
  })

  it('a clicked unknown / defer / none_of_above maps to that kind', () => {
    expect(clarificationAnswerToDecision({ selectedLabels: ['unknown'] }).kind).toBe('unknown')
    expect(clarificationAnswerToDecision({ selectedLabels: ['defer'] }).kind).toBe('defer')
    expect(clarificationAnswerToDecision({ selectedLabels: ['none_of_above'] }).kind).toBe('none_of_above')
  })

  it('free text alone is a concrete `answer` (the stakeholder\'s words, never dropped)', () => {
    expect(clarificationAnswerToDecision({ custom: 'seats available to all' }).kind).toBe('answer')
  })

  it('a free-text keyword alone (harness path) maps to that kind', () => {
    expect(clarificationAnswerToDecision({ custom: 'defer' }).kind).toBe('defer')
    expect(clarificationAnswerToDecision({ custom: 'unknown' }).kind).toBe('unknown')
    expect(clarificationAnswerToDecision({ custom: 'confirm' }).kind).toBe('confirm')
  })

  it('a bare confirm is a `confirm`, but confirm WITH a value is a concrete `answer`', () => {
    // A yes with no value is not a value.
    expect(clarificationAnswerToDecision({ selectedLabels: ['confirm'] }).kind).toBe('confirm')
    // A yes that carries the actual value is an answer (the value is stored + provenance stamped).
    expect(clarificationAnswerToDecision({ selectedLabels: ['confirm'], custom: '10% tax' }).kind).toBe('answer')
  })

  it('a terminal keyword (unknown/defer/none_of_above) is NOT laundered into an answer by side text', () => {
    // An explicit "unknown" with a note stays a refusal — never turned into a fabricated value.
    expect(clarificationAnswerToDecision({ selectedLabels: ['unknown'], custom: 'really have no idea' }).kind).toBe('unknown')
    expect(clarificationAnswerToDecision({ selectedLabels: ['defer'], custom: 'decide later this term' }).kind).toBe('defer')
    expect(clarificationAnswerToDecision({ selectedLabels: ['none_of_above'], custom: 'none of those' }).kind).toBe('none_of_above')
  })

  it('no answer at all is the honest floor: `unknown` (nothing confirmed, nothing fabricated)', () => {
    expect(clarificationAnswerToDecision({}).kind).toBe('unknown')
    expect(clarificationAnswerToDecision({ selectedLabels: [], custom: '' }).kind).toBe('unknown')
  })

  it('a non-option label is not invented into a decision kind (falls back to the answer floor)', () => {
    // A misclicked / unknown label with no text must not become a confirmation.
    expect(clarificationAnswerToDecision({ selectedLabels: ['something else'] }).kind).toBe('unknown')
  })
})
