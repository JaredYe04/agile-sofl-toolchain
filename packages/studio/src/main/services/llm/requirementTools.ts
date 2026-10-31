/**
 * Requirement-layer typed domain tools — the THIN Studio wrappers over `RefinementSession`
 * (task book §6.1: "do not create a second agent system"; the agent loop keeps turns/permissions/
 * approval, and these tools are one typed call into the requirement-layer core).
 *
 * This module is PURE (no fs, no Electron, no LLM): it takes an already-loaded `RefinementSession`
 * + the parsed input and returns the tool-result payload. The agent loop is responsible for
 * loading/saving the session per project (see `requirementStore.ts`) and for gating permissions
 * before calling here. Keeping it pure makes the tools unit-testable without Electron.
 *
 * ANTI-FABRICATION (task book §6.1: "record_decision 不能由 Agent 假扮用户直接调用；实验中必须
 * 明确使用经过隔离的 simulator actor"): the LLM NEVER calls record_decision. It only ORIENTS
 * (read_requirement_graph / list_obligations / select_next_clarification / assess_readiness) and
 * PRESENTS the stakeholder question via the loop's ask_clarification, tagging it with the
 * obligationId it came from. The stakeholder then answers in the UI (option click and/or typed
 * text) — and ONLY that human answer is recorded: the loop threads it here via
 * `recordHumanClarificationAnswer`, which maps the raw answer to a DecisionAnswer
 * (`clarificationAnswerToDecision`, pure) and commits it with actor `user`. The model can
 * neither choose the answer nor impersonate the actor; there is no code path by which a guess
 * becomes a `user_confirmed` source. The isolated `simulated_user` actor exists for the P5
 * experiment harness, which drives `RefinementSession` directly (its oracle), never through
 * this product surface. The provenance enforcement that stops any laundering still lives in the
 * core (provenance.ts).
 */
import {
  RefinementSession,
  type ActorKind,
  type DecisionAnswer,
  type ReadinessVerdict,
  type RefinementObligation,
} from '@agile-sofl/refinement'

/** A single tool-result payload the agent loop pushes back as the tool message content. */
export interface RequirementToolResult {
  ok: boolean
  /** The JSON-serializable result body (read back by the LLM as the tool output). */
  content: Record<string, unknown>
  /** True when the tool mutated the session (the loop persists a snapshot afterward). */
  mutated: boolean
}

const STAGE_DEFAULT = 'impl'

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

// ---- read_requirement_graph --------------------------------------------

function readRequirementGraph(session: RefinementSession, args: Record<string, unknown>): RequirementToolResult {
  const scope = str(args.scope)
  const includeLinks = args.includeLinks !== false
  const nodes = session.graph.allNodes().map((n) => ({
    id: n.id,
    type: n.nodeType,
    title: n.title,
    scope: n.scope,
    parentId: n.parentId,
    status: n.status,
    source: n.source,
    criticality: n.criticality,
    version: n.version,
  }))
  const edges = includeLinks
    ? session.graph.allEdges().map((e) => ({ id: e.id, source: e.source, target: e.target, kind: e.kind }))
    : []
  const summary = session.readRefinementTree({ scope })
  return {
    ok: true,
    mutated: false,
    content: {
      ok: true,
      docVersion: session.docVersion,
      nodes,
      edges,
      counts: {
        nodes: summary.nodes,
        edges: summary.edges,
        openObligations: summary.openObligations,
        openCriticalObligations: summary.openCriticalObligations,
      },
      verdictPreview: summary.verdictPreview,
    },
  }
}

// ---- list_obligations ---------------------------------------------------

function obligationView(o: RefinementObligation): Record<string, unknown> {
  return {
    id: o.id,
    nodeId: o.nodeId,
    kind: o.kind,
    description: o.description,
    severity: o.severity,
    status: o.status,
    detectorClass: o.detectorClass,
    policyRequired: o.policyRequired,
    checkerOrigin: o.checkerOrigin,
  }
}

function listObligations(session: RefinementSession, args: Record<string, unknown>): RequirementToolResult {
  const severity = str(args.severity) as 'critical' | 'major' | 'minor' | undefined
  const status = str(args.status) as RefinementObligation['status'] | undefined
  const list = session.listOpenObligations({ severity, status })
  return {
    ok: true,
    mutated: false,
    content: {
      ok: true,
      count: list.length,
      obligations: list.map(obligationView),
      // Convenience: which of these are the high-impact policy ones (gated, must be confirmed one-by-one).
      highImpact: list.filter((o) => o.policyRequired && o.severity === 'critical').map((o) => o.id),
    },
  }
}

// ---- select_next_clarification ------------------------------------------

function selectNextClarification(session: RefinementSession, args: Record<string, unknown>): RequirementToolResult {
  const budgetRemaining = num(args.budgetRemaining)
  const stage = str(args.stage) ?? STAGE_DEFAULT
  const next = session.selectNextClarification({ budgetRemaining, stage })
  if (!next) {
    return {
      ok: true,
      mutated: false,
      content: {
        ok: true,
        next: null,
        reason: 'No eligible, not-yet-answered clarification remains (or the budget is exhausted).',
      },
    }
  }
  return {
    ok: true,
    mutated: false,
    content: {
      ok: true,
      next: {
        obligationId: next.obligationId,
        targetNodeId: next.targetNodeId,
        question: next.question,
        isHighImpactPolicy: next.isHighImpactPolicy,
        gated: next.gated,
        score: next.score,
        reasons: next.reasons,
        // The option set the stakeholder should be offered (task book §6.2 — always include these).
        options: next.candidate.choiceOptions ?? ['confirm', 'unknown', 'defer', 'none_of_above'],
        supports: {
          freeText: next.candidate.supportsFreeText,
          unknown: next.candidate.supportsUnknown,
          defer: next.candidate.supportsDefer,
          noneOfAbove: next.candidate.supportsNoneOfAbove,
        },
      },
    },
  }
}

// ---- record the HUMAN's clarification answer ----------------------------
//
// The only path by which a stakeholder decision reaches the requirement layer. The loop calls
// this from resumeWithToolResult, where the answer is the text the HUMAN submitted in the UI
// (clicked option label(s) plus typed text) for a clarification tagged with an obligationId.

/** The option label an obligation presents for the stakeholder (select_next_clarification `options`). */
export const CLARIFICATION_OPTION_LABELS = ['confirm', 'unknown', 'defer', 'none_of_above'] as const

const LABEL_TO_KIND = new Map<string, DecisionAnswer['kind']>([
  ['confirm', 'confirm'],
  ['unknown', 'unknown'],
  ['defer', 'defer'],
  ['none_of_above', 'none_of_above'],
])

/**
 * Map the STAKEHOLDER's raw clarification answer (clicked option label + free text, from the
 * Studio UI, or plain text from the experiment oracle) to a `DecisionAnswer`. PURE — no session,
 * no fs — so the mapping is unit-testable and there is exactly one place that turns an answer
 * into a decision. The four option labels are exactly the keywords confirm/unknown/defer/
 * none_of_above:
 *   - `confirm` + a real value -> kind 'answer' (a concrete value, not a bare yes): the core
 *     stores the value and stamps the HONEST provenance for the actor;
 *   - `confirm` alone (click, or the bare word, no value) -> kind 'confirm';
 *   - `unknown` / `defer` / `none_of_above` are TERMINAL no-matter what text accompanies them
 *     (the text is kept as a note, but the obligation is never discharged) — an explicit refusal
 *     to confirm can never be laundered into a value;
 *   - free text that is NOT a keyword is a concrete value (kind 'answer');
 *   - nothing at all -> kind 'unknown' (the honest floor: no value confirmed, nothing fabricated).
 */
export function clarificationAnswerToDecision(input: {
  selectedLabels?: string[]
  custom?: string
}): DecisionAnswer {
  const selected = (input.selectedLabels ?? []).map((s) => s.trim()).filter(Boolean)
  const custom = (input.custom ?? '').trim()
  const label = selected[0]
  // Is the free text itself one of the keyword words (the harness/oracle answers in plain text)?
  const keywordFromText = LABEL_TO_KIND.get(custom.toLowerCase())
  // Is the free text a real value (non-empty and not just a keyword word)?
  const hasValue = custom.length > 0 && !keywordFromText
  const explicitFromLabel = label ? LABEL_TO_KIND.get(label.toLowerCase()) : undefined
  let kind: DecisionAnswer['kind']
  if (explicitFromLabel === 'confirm') {
    kind = hasValue ? 'answer' : 'confirm'
  } else if (explicitFromLabel) {
    kind = explicitFromLabel // unknown / defer / none_of_above are terminal
  } else if (keywordFromText) {
    kind = keywordFromText
  } else {
    kind = hasValue ? 'answer' : 'unknown'
  }
  return {
    kind,
    answer: custom || undefined,
    freeText: custom || undefined,
    options: selected.length ? selected : undefined,
  }
}

/**
 * Record the STAKEHOLDER's answer to a tagged clarification into the session. The answer text and
 * the actor both come from the loop's resume path (product UI) or the experiment harness's oracle
 * — the model neither supplies nor rewrites them, so a guess can never become a confirmed source:
 *   - product UI path: actor `user` (the person who answered in the Studio);
 *   - experiment path: the ISOLATED `simulated_user` oracle (task book §6.1 — the agent never
 *     impersonates the user; the isolated simulator is the experiment's actor).
 * Unknown obligations return a not-ok result (nothing fabricated).
 */
export function recordHumanClarificationAnswer(
  session: RefinementSession,
  obligationId: string,
  input: { selectedLabels?: string[]; custom?: string },
  actor: ActorKind = 'user'
): RequirementToolResult {
  if (!session.engine.get(obligationId)) {
    return {
      ok: false,
      mutated: false,
      content: { ok: false, error: `No open obligation ${obligationId} — nothing was recorded.` },
    }
  }
  const answer = clarificationAnswerToDecision(input)
  try {
    const effect = session.recordDecision({ obligationId, answer, actorKind: actor })
    return {
      ok: true,
      mutated: true,
      content: {
        ok: true,
        decisionId: effect.decisionId,
        recordedFrom: actor === 'simulated_user' ? 'simulated_oracle_answer' : 'human_clarification_answer',
        actor,
        answer: answer.kind,
        answered: effect.answeredObligationIds,
        discharged: effect.dischargedObligationIds,
        deferred: effect.deferredObligationIds,
        promoted: effect.promotedNodeIds,
        nodeStatusChanges: effect.nodeStatusChanges,
        nodeSourceChanges: effect.nodeSourceChanges,
        impactedNodeIds: effect.impactedNodeIds,
        // A structural tripwire: only true if a non-real actor somehow stamped a confirmed source.
        fabricated: effect.fabricated,
        docVersion: session.docVersion,
      },
    }
  } catch (e) {
    return {
      ok: false,
      mutated: false,
      content: { ok: false, error: `Recording the clarification answer failed: ${e instanceof Error ? e.message : String(e)}` },
    }
  }
}

// ---- assess_readiness ---------------------------------------------------

function assessReadiness(session: RefinementSession, args: Record<string, unknown>): RequirementToolResult {
  const scope = str(args.scope)
  const targetStage = str(args.targetStage) ?? STAGE_DEFAULT
  const nodeIds = asStringArray(args.nodeIds)
  const budgetRemaining = num(args.budgetRemaining)
  const assessment = session.assessReadiness(scope ?? 'default', targetStage, {
    nodeIds: nodeIds.length ? nodeIds : undefined,
    budgetRemaining,
  })
  return {
    ok: true,
    mutated: false,
    content: {
      ok: true,
      verdict: assessment.verdict as ReadinessVerdict,
      reason: assessment.reason,
      scope: assessment.scope,
      targetStage: assessment.targetStage,
      unresolvedCriticalObligations: assessment.unresolvedCriticalObligations,
      deferredObligations: assessment.deferredObligations,
      checkerDiagnostics: assessment.checkerDiagnostics,
      decisionProvenance: assessment.decisionProvenance,
    },
  }
}

/**
 * Dispatch a requirement-layer tool call onto a live `RefinementSession`. Pure: no fs / Electron.
 * Only the READ/ASSESS tools are LLM-callable here. `record_decision` is deliberately NOT
 * dispatched: it is never offered to the model (see REQUIREMENT_TOOL_NAMES), and if a stale or
 * hallucinated call ever reaches this dispatch it returns an explicit error rather than acting —
 * task book §6.1 (the agent must not record a stakeholder decision itself).
 */
export function runRequirementTool(
  session: RefinementSession,
  toolName: string,
  args: Record<string, unknown>
): RequirementToolResult {
  switch (toolName) {
    case 'read_requirement_graph':
      return readRequirementGraph(session, args)
    case 'list_obligations':
      return listObligations(session, args)
    case 'select_next_clarification':
      return selectNextClarification(session, args)
    case 'assess_readiness':
      return assessReadiness(session, args)
    case 'record_decision':
      return {
        ok: false,
        mutated: false,
        content: {
          ok: false,
          error:
            'record_decision is not an agent tool. Present the stakeholder question via ask_clarification (with the obligationId from select_next_clarification); the stakeholder answers in the UI and that answer is recorded by the loop. Never record a decision yourself.',
        },
      }
    default:
      return { ok: false, mutated: false, content: { ok: false, error: `Unknown requirement tool ${toolName}` } }
  }
}

/** The requirement-layer tools the LLM may call (reads + readiness only).
 *  `record_decision` is intentionally ABSENT: decisions enter through the human's clarification
 *  answer (see recordHumanClarificationAnswer), never through the model (task book §6.1). */
export const REQUIREMENT_TOOL_NAMES = [
  'read_requirement_graph',
  'list_obligations',
  'select_next_clarification',
  'assess_readiness',
] as const

export type RequirementToolName = (typeof REQUIREMENT_TOOL_NAMES)[number]

/**
 * Permission gate for the requirement tools (task book §6.1: read/check free; decisions gated).
 * Every LLM-callable requirement tool is a READ (graph/obligations/selection/readiness) — the
 * mutating path is the human's recorded clarification answer, which is not a tool call.
 */
export function requirementToolAllowed(
  name: RequirementToolName,
  permissions: { hybrid: { read: boolean; write: boolean } }
): boolean {
  return permissions.hybrid.read
}
