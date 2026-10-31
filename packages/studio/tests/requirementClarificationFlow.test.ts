import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const userData = mkdtempSync(join(tmpdir(), 'req-flow-ud-'))
vi.mock('electron', () => ({ app: { getPath: () => userData, getAppPath: () => userData }, ipcMain: { handle: () => undefined } }))

import { RefinementSession, deterministicIdGen } from '@agile-sofl/refinement'
import { runAgentTurn, resumeWithToolResult, type AgentTurnContext } from '../src/main/services/llm/agentLoop'
import { generationAgentPermissions, newId, type AgentSession } from '../src/main/services/llm/agentTypes'
import { saveRequirementSession, loadRequirementSession } from '../src/main/services/llm/requirementStore'
import { composeClarificationAnswer, encodeClarificationAnswer } from '../src/shared/clarificationAnswer'

/**
 * P4 end-to-end (task book §6.1: "record_decision 不能由 Agent 假扮用户直接调用"). These tests drive
 * the REAL agent loop (mock LLM, real on-disk requirement session) to prove the anti-fabrication
 * wiring end to end:
 *   1. The LLM only ORIENTS (select_next_clarification) and PRESENTS (ask_clarification with the
 *      obligationId). The HUMAN's answer to that clarification is recorded into the project's
 *      RefinementSession under actor `user` — the node becomes `user_confirmed`/`ready`, the
 *      obligation is satisfied, and the loop sees the decision so it never re-asks.
 *   2. If the model HALLUCINATES a record_decision call (an agent impersonating the user), the loop
 *      REFUSES it: the obligation stays open, the node stays `AI_hypothesis` — nothing is
 *      fabricated, and the model is told it cannot record decisions.
 *
 * The experiment counterpart (the isolated `simulated_user` oracle answering in plain text through
 * the harness's resolveClarification hook) is the P5 surface; the mapping + actor path it uses is
 * unit-pinned in requirementTools.test.ts.
 */

function sseOf(chunks: unknown[]): Response {
  const body = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n'
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

function toolCallWithId(id: string, name: string, args: unknown): Response {
  return sseOf([
    { model: 'mock-model', choices: [{ delta: { tool_calls: [{ index: 0, id, function: { name, arguments: JSON.stringify(args) } }] } }] },
    { model: 'mock-model', choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
    { model: 'mock-model', choices: [], usage: { prompt_tokens: 11, completion_tokens: 3 } }
  ])
}

const stopReply = (): Response =>
  sseOf([{ model: 'mock-model', choices: [{ delta: { content: 'Done.' }, finish_reason: 'stop' }] }])

function freshSession(): AgentSession {
  const now = new Date().toISOString()
  return { id: newId('sess'), moduleId: 'project', title: 'Requirement Analysis', createdAt: now, updatedAt: now, messages: [], context: {} }
}

/** Seed a project with a two-capability requirement tree, each capability carrying an open policy
 *  obligation (the common refinement situation), persisted as the project's requirement artifact. */
function seedProject(root: string): { capA: string; oA: string } {
  const s = new RefinementSession({
    idGen: deterministicIdGen('rn'),
    obligationIdGen: deterministicIdGen('ob'),
    decisionIdGen: deterministicIdGen('dec'),
    readinessIdGen: deterministicIdGen('rdy'),
    now: () => 1
  })
  const goal = s.graph.addNode({ nodeType: 'system_goal', title: 'Reserve a seat', description: 'd', scope: 'booking' })
  const [capA, capB] = s.proposeRefinement(goal.id, [
    { nodeType: 'capability', title: 'Seat availability', description: 'd' },
    { nodeType: 'capability', title: 'Seat role policy', description: 'd' }
  ])
  const oA = s.engine.open({ nodeId: capA, kind: 'policy_confirmation', description: 'confirm the seat availability rule' })
  s.engine.open({ nodeId: capB, kind: 'role_permission', description: 'confirm the seat role policy' })
  saveRequirementSession(root, s)
  return { capA, oA: oA.id }
}

const OBLIGATION_OPTIONS = [
  { id: 'confirm', label: 'confirm' },
  { id: 'unknown', label: 'unknown' },
  { id: 'defer', label: 'defer' },
  { id: 'none_of_above', label: 'none_of_above' }
]

const tmpRoots: string[] = []
function tmpProject(): string {
  const root = mkdtempSync(join(tmpdir(), 'req-flow-'))
  tmpRoots.push(root)
  return root
}
afterEach(() => {
  vi.unstubAllGlobals()
  while (tmpRoots.length) {
    const p = tmpRoots.pop()!
    try {
      rmSync(p, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
})

describe('requirement clarification flow (end-to-end, real loop + on-disk session)', () => {
  it('records the HUMAN answer to a tagged clarification into the session (actor user; node user_confirmed)', async () => {
    process.env.ECNU_API_KEY = 'sk-testtesttesttest'
    const root = tmpProject()
    const { capA, oA } = seedProject(root)

    // The LLM orients (read-only select) and PRESENTS the question tagged with the obligationId.
    // It does NOT record anything itself.
    const replies: Response[] = [
      toolCallWithId('c-sel', 'select_next_clarification', { budgetRemaining: 5 }),
      toolCallWithId(
        'c-ask',
        'ask_clarification',
        { question: 'Please confirm the seat availability rule.', options: OBLIGATION_OPTIONS, allowCustom: true, obligationId: oA }
      ),
      stopReply()
    ]
    vi.stubGlobal('fetch', vi.fn(async () => replies.shift() ?? stopReply()))

    const ctx: AgentTurnContext = {
      projectName: 'pilot',
      projectRoot: root,
      moduleId: 'project',
      informalMarkdown: '',
      hybridAsfl: '',
      skillId: 'hybrid-generation',
      permissions: generationAgentPermissions()
    }
    let session = await runAgentTurn(freshSession(), root, ctx, 'Refine the booking requirement.')
    // The turn is now waiting on the human for the tagged clarification.
    const pending = session.messages.find((m) => m.pending)
    expect(pending?.clarification?.obligationId).toBe(oA)
    expect(session.context.pendingToolCallId).toBe('c-ask')

    // The HUMAN clicks the "confirm" option in the UI (the Studio encodes {selected, custom}).
    const humanAnswer = encodeClarificationAnswer(composeClarificationAnswer({ selectedLabels: ['confirm'], custom: '', multiSelect: false }))
    session = await resumeWithToolResult(session, root, ctx, 'c-ask', humanAnswer, undefined, true)

    // The decision was recorded from the human's answer and persisted:
    const loaded = loadRequirementSession(root)
    expect(loaded.engine.get(oA)?.status).toBe('satisfied')
    expect(loaded.graph.getNode(capA)?.status).toBe('ready')
    expect(loaded.graph.getNode(capA)?.source).toBe('user_confirmed')

    // The loop saw the decision (so it must not re-ask), under the human's name:
    const toolMsg = session.messages.find((m) => m.id === 'c-ask' && m.role === 'tool')
    const body = JSON.parse(toolMsg!.content) as Record<string, any>
    expect(body.type).toBe('clarification_answer')
    expect(body.requirementDecision?.ok).toBe(true)
    expect(body.requirementDecision?.actor).toBe('user')
    expect(body.requirementDecision?.recordedFrom).toBe('human_clarification_answer')
    expect(String(body.requirementDecision?.next)).toMatch(/ALREADY recorded/i)
  }, 60000)

  it('REFUSES a hallucinated record_decision call (the agent cannot impersonate the user; nothing fabricated)', async () => {
    process.env.ECNU_API_KEY = 'sk-testtesttesttest'
    const root = tmpProject()
    const { capA, oA } = seedProject(root)

    // The model attempts to record a decision ITSELF, claiming to be the user with an invented
    // answer. This is exactly what task book §6.1 forbids — the loop must refuse it.
    const replies: Response[] = [
      toolCallWithId('c-rec', 'record_decision', {
        obligationId: oA,
        actor: 'user',
        answer: { kind: 'confirm', answer: 'always available' }
      }),
      stopReply()
    ]
    vi.stubGlobal('fetch', vi.fn(async () => replies.shift() ?? stopReply()))

    const ctx: AgentTurnContext = {
      projectName: 'pilot',
      projectRoot: root,
      moduleId: 'project',
      informalMarkdown: '',
      hybridAsfl: '',
      skillId: 'hybrid-generation',
      permissions: generationAgentPermissions()
    }
    const session = await runAgentTurn(freshSession(), root, ctx, 'Refine the booking requirement.')

    // The tool call was refused with explicit guidance — and NOTHING was recorded:
    const toolMsg = session.messages.find((m) => m.id === 'c-rec' && m.role === 'tool')
    const body = JSON.parse(toolMsg!.content) as Record<string, any>
    expect(body.ok).toBe(false)
    expect(String(body.error)).toMatch(/not an agent tool/i)

    const loaded = loadRequirementSession(root)
    expect(loaded.engine.get(oA)?.status).toBe('open')
    expect(loaded.graph.getNode(capA)?.status).toBe('draft')
    expect(loaded.graph.getNode(capA)?.source).toBe('AI_hypothesis')
  }, 60000)
})
