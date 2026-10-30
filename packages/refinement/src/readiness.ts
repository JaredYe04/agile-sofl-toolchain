/**
 * Readiness assessment (conceptual-model section 6) — the explicit stop mechanism.
 *
 * Verdicts: READY | NEEDS_CLARIFICATION | DEFERRED | BLOCKED | INCOMPLETE_WITH_RISK.
 *
 * READY requires, within scope:
 *   - all critical obligations satisfied OR explicitly risk-accepted (waived),
 *   - all required decisions confirmed,
 *   - no blocking (graph-invariant) checker diagnostics,
 *   - a met readiness policy.
 *
 * Budget exhaustion or "no more candidates" does NOT alone imply READY (task book 6.5). A budget being
 * out is a *stop* signal (INCOMPLETE_WITH_RISK), never a pass.
 */
import type { ReadinessAssessment, ReadinessVerdict } from './types.js'
import type { IdGen } from './id.js'
import { randomIdGen } from './id.js'
import type { RequirementGraph } from './graph.js'
import type { ObligationEngine } from './obligations.js'
import type { DecisionStore } from './decisions.js'

export interface ReadinessScope {
  scope: string
  targetStage: string
  /** Node ids in scope (empty => the whole graph). */
  nodeIds?: string[]
  /** When the clarification budget is exhausted. Stopping, NOT passing (section 6). */
  budgetExhausted?: boolean
  /** Remaining clarification budget (# questions). `<= 0` => exhausted. */
  budgetRemaining?: number
}

export interface ReadinessInput {
  graph: RequirementGraph
  engine: ObligationEngine
  decisions: DecisionStore
  scope: ReadinessScope
  /** Optional pre-computed checker diagnostics (parser codes) to record. */
  checkerDiagnostics?: string[]
}

export class ReadinessAssessor {
  private readonly idGen: IdGen

  constructor(idGen: IdGen = randomIdGen()) {
    this.idGen = idGen
  }

  /** Compute a ReadinessAssessment for the scope. Deterministic given the inputs. */
  assess(input: ReadinessInput): ReadinessAssessment {
    const { graph, engine, decisions, scope } = input
    const budgetExhausted =
      scope.budgetExhausted === true || (scope.budgetRemaining !== undefined && scope.budgetRemaining <= 0)

    // Node scope.
    const inScope = scope.nodeIds?.length
      ? scope.nodeIds.filter((id) => graph.getNode(id) !== undefined)
      : graph.allNodes().map((n) => n.id)
    const inScopeSet = new Set(inScope)

    // Obligation views.
    const critical = engine.openCritical().filter((o) => inScopeSet.has(o.nodeId))
    const deferred = engine.all().filter((o) => o.status === 'deferred' && inScopeSet.has(o.nodeId))
    const waived = engine.all().filter((o) => o.status === 'waived' && inScopeSet.has(o.nodeId))

    // Blocking diagnostics = graph invariant violations + (optionally) parser diagnostics.
    const invariantErrors = graph.validate()
    const checkerDiagnostics = [...invariantErrors.map((e) => `${e.code}: ${e.message}`), ...(input.checkerDiagnostics ?? [])]
    const hasBlockingDiagnostics = invariantErrors.length > 0

    // Node status within scope.
    const blockedNodes = inScope.filter((id) => graph.getNode(id)?.status === 'blocked')
    const needsClarification = inScope.filter((id) => graph.getNode(id)?.status === 'needs_clarification')

    // Decision provenance within scope (for the assessment record).
    const decisionProvenance = decisions
      .active()
      .filter((d) => d.targetNodeIds.some((id) => inScopeSet.has(id)))
      .map((d) => `${d.decisionId}:${d.provenance}`)

    // ---- verdict (priority: blocking > critical-open > needs-clar > deferred > ready) ----
    let verdict: ReadinessVerdict
    let reason: string

    if (hasBlockingDiagnostics || blockedNodes.length > 0) {
      verdict = 'BLOCKED'
      reason =
        `blocked: ${invariantErrors.length} invariant violation(s), ` +
        `${blockedNodes.length} blocked node(s)`
    } else if (critical.length > 0) {
      // Open critical obligations (none waived): a required decision or clarification is outstanding.
      verdict = 'NEEDS_CLARIFICATION'
      reason = `${critical.length} unresolved critical obligation(s) in scope`
    } else if (needsClarification.length > 0) {
      verdict = 'NEEDS_CLARIFICATION'
      reason = `${needsClarification.length} node(s) in needs_clarification`
    } else if (deferred.length > 0) {
      verdict = 'DEFERRED'
      reason = `all critical obligations resolved but ${deferred.length} obligation(s) deferred (tracked, not approved)`
    } else {
      // All critical satisfied/waived, no blocking diagnostics, no needs-clarification, no deferrals.
      verdict = 'READY'
      reason = `readiness policy met: ${waived.length} waived, no open critical, no blocking diagnostics`
    }

    // Budget exhaustion is a STOP, not a pass (task book 6.5): it does NOT by itself imply READY.
    //   - READY + out of budget  -> still READY (the policy was met; the stop coincides with done).
    //   - BLOCKED + out of budget-> still BLOCKED (a hard stop dominates the budget signal).
    //   - otherwise (NEEDS_CLARIFICATION / DEFERRED) + out of budget -> INCOMPLETE_WITH_RISK: we
    //     stopped before the policy was met, so there is unaddressed risk.
    if (budgetExhausted && verdict !== 'READY' && verdict !== 'BLOCKED') {
      verdict = 'INCOMPLETE_WITH_RISK'
      reason = `budget exhausted before readiness policy met (${reason})`
    }

    return {
      id: this.idGen('rdy'),
      scope: scope.scope,
      targetStage: scope.targetStage,
      unresolvedCriticalObligations: critical.map((o) => o.id),
      deferredObligations: deferred.map((o) => o.id),
      checkerDiagnostics,
      decisionProvenance,
      verdict,
      reason,
    }
  }
}
