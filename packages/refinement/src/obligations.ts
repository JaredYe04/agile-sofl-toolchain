/**
 * Refinement obligations (conceptual-model section 3) — the core contribution.
 *
 * An obligation is a first-class, explainable unit: it names its **detector class**, evidence, and
 * discharge condition. The critical distinction (task book 4.4), enforced structurally here:
 *   - `mechanical`     : a deterministic checker opens AND auto-discharges it (no LLM, no decision).
 *   - `llm_candidate`  : an LLM may only RAISE it; it discharges via a decision (confirm/dismiss), never
 *                        by the checker alone.
 *   - `user_decision`  : cannot be auto-discharged at all; requires a decision stamped by a real (or, in
 *                        experiments, explicitly simulated) actor. An LLM guess can NEVER close it.
 *
 * We do NOT claim a checker proves semantic completeness of natural-language requirements; an obligation
 * is *obligation closure* under the tool's rules (consistent with docs/25).
 *
 * Detector sources (two, both fed through this engine):
 *   1. graph-level mechanical detectors — pure over the requirement graph (deterministic, testable).
 *   2. ingested spec-level diagnostics  — from the Agile-SOFL parser/checker (P4/P5), carried as
 *      `checkerOrigin` codes (e.g. an ASFL_FSF_003) so nothing is re-derived from scratch.
 */
import type {
  ActorKind,
  ObligationSeverity,
  ProvenanceStatus,
  RefinementObligation,
} from './types.js'
import type { IdGen } from './id.js'
import { randomIdGen } from './id.js'
import { isProvenanceLegal } from './provenance.js'
import type { RequirementGraph } from './graph.js'

/** The candidate obligation kinds and their default detector class + severity (section 3 table). */
export const OBLIGATION_KINDS = {
  goal_decomposition_coverage: { detectorClass: 'llm_candidate', severity: 'major' },
  precondition_input_constraint: { detectorClass: 'mechanical', severity: 'major' },
  postcondition_observable_behavior: { detectorClass: 'llm_candidate', severity: 'major' },
  data_state_update: { detectorClass: 'mechanical', severity: 'major' },
  failure_path: { detectorClass: 'llm_candidate', severity: 'major' },
  boundary_condition: { detectorClass: 'llm_candidate', severity: 'minor' },
  role_permission: { detectorClass: 'user_decision', severity: 'critical' },
  cross_process_dependency_conflict: { detectorClass: 'mechanical', severity: 'critical' },
  acceptance_scenario: { detectorClass: 'mechanical', severity: 'major' },
  policy_confirmation: { detectorClass: 'user_decision', severity: 'critical' },
} as const

export type ObligationKind = keyof typeof OBLIGATION_KINDS

/** The obligation kinds the graph-level mechanical detectors actually produce (and thus may auto-discharge). */
const GRAPH_DETECTED_KINDS: ReadonlySet<string> = new Set<string>([
  'cross_process_dependency_conflict',
  'acceptance_scenario',
  'data_state_update',
])

export class ObligationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ObligationError'
  }
}

/** A reference to the decision that discharges an obligation. */
export interface DecisionRef {
  decisionId: string
  actorKind: ActorKind
  provenance: ProvenanceStatus
  answer: string
}

/** How an obligation is being discharged. */
export type DischargeHow =
  | { kind: 'checker' }
  | { kind: 'decision'; decision: DecisionRef }
  | { kind: 'waive'; justification: string }

/** A finding from a mechanical detector (what an obligation SHOULD be open for). */
interface MechanicalFinding {
  nodeId: string
  kind: ObligationKind
  description: string
  evidenceRefs: string[]
}

export interface DetectResult {
  opened: RefinementObligation[]
  discharged: RefinementObligation[]
}

/**
 * A decision may discharge any decision/LLM-gated obligation, but it must CARRY a confirming provenance:
 * a raw guess (`AI_hypothesis`) is not an answer, and a deferral (`deferred`) is tracked by `defer()`, not
 * closed here. The actor/provenance pairing is checked against the anti-fabrication table in
 * `provenance.ts`, which is what structurally blocks a simulated user from laundering a guess into
 * `user_confirmed`. A `waive` close is legal for all classes (explicit risk acceptance).
 */
export interface ObligationEngineOptions {
  idGen?: IdGen
  now?: () => number
}

export class ObligationEngine {
  private obligations = new Map<string, RefinementObligation>()
  private readonly idGen: IdGen
  private readonly now: () => number

  constructor(options: ObligationEngineOptions = {}) {
    this.idGen = options.idGen ?? randomIdGen()
    this.now = options.now ?? (() => Date.now())
  }

  // ---- queries ---------------------------------------------------------

  all(): RefinementObligation[] {
    return [...this.obligations.values()]
  }
  get(id: string): RefinementObligation | undefined {
    return this.obligations.get(id)
  }
  byNode(nodeId: string): RefinementObligation[] {
    return this.all().filter((o) => o.nodeId === nodeId)
  }
  openObligations(): RefinementObligation[] {
    return this.all().filter((o) => o.status === 'open' || o.status === 'disputed')
  }
  openCritical(): RefinementObligation[] {
    return this.openObligations().filter((o) => o.severity === 'critical')
  }

  // ---- open ------------------------------------------------------------

  /** Manually open an obligation (LLM candidate, user decision, or ingested spec diagnostic). */
  open(input: {
    nodeId: string
    kind: ObligationKind | string
    description: string
    detectorClass?: RefinementObligation['detectorClass']
    severity?: ObligationSeverity
    checkerOrigin?: string
    evidenceRefs?: string[]
    policyRequired?: boolean
  }): RefinementObligation {
    const kindDef = typeof input.kind === 'string' && input.kind in OBLIGATION_KINDS
      ? OBLIGATION_KINDS[input.kind as ObligationKind]
      : undefined
    const obligation: RefinementObligation = {
      id: this.idGen('ob'),
      nodeId: input.nodeId,
      kind: input.kind,
      description: input.description,
      severity: input.severity ?? kindDef?.severity ?? 'major',
      status: 'open',
      detectorClass: input.detectorClass ?? kindDef?.detectorClass ?? 'llm_candidate',
      checkerOrigin: input.checkerOrigin ?? 'requirement-graph',
      evidenceRefs: input.evidenceRefs ?? [],
      policyRequired:
        input.policyRequired ?? (input.kind === 'policy_confirmation' || input.kind === 'role_permission'),
      lastEvaluatedAt: this.now(),
    }
    this.obligations.set(obligation.id, obligation)
    return obligation
  }

  /**
   * Ingest a spec-level (parser/checker) mechanical diagnostic as an obligation. Used in P4/P5 to map
   * ASFL codes onto the requirement layer without re-deriving them. Deterministic, no LLM.
   */
  ingestExternal(input: {
    nodeId: string
    kind: ObligationKind | string
    description: string
    checkerOrigin: string // e.g. 'ASFL_FSF_003' or a parser DiagnosticCodes value
    severity?: ObligationSeverity
    evidenceRefs?: string[]
  }): RefinementObligation {
    return this.open({
      nodeId: input.nodeId,
      kind: input.kind,
      description: input.description,
      detectorClass: 'mechanical',
      severity: input.severity ?? 'major',
      checkerOrigin: input.checkerOrigin,
      evidenceRefs: input.evidenceRefs ?? [],
    })
  }

  // ---- mechanical detection (deterministic; no LLM) --------------------

  /**
   * Run the graph-level mechanical detectors over `graph`, reconciling open mechanical obligations:
   *   - open new ones where a detector fires,
   *   - auto-discharge open mechanical ones whose condition has cleared.
   * Idempotent: a second run on the same graph opens nothing new. Deterministic given the graph.
   */
  detect(graph: RequirementGraph): DetectResult {
    const findings = mechanicalDetectors(graph)
    const wanted = new Map<string, MechanicalFinding>() // key: `${nodeId}::${kind}`
    for (const f of findings) {
      const key = `${f.nodeId}::${f.kind}`
      if (!wanted.has(key)) wanted.set(key, f)
    }
    const opened: RefinementObligation[] = []
    const discharged: RefinementObligation[] = []
    for (const f of wanted.values()) {
      if (this.findOpen(f.nodeId, f.kind)) continue // already open
      const o = this.open({
        nodeId: f.nodeId,
        kind: f.kind,
        description: f.description,
        detectorClass: OBLIGATION_KINDS[f.kind].detectorClass,
        severity: OBLIGATION_KINDS[f.kind].severity,
        checkerOrigin: 'requirement-graph',
        evidenceRefs: f.evidenceRefs,
      })
      this.recordEvent(o.id, 'checker')
      opened.push(o)
    }
    // Auto-discharge only the obligations the graph detectors are responsible for, whose condition
    // cleared. Manually-opened or ingested mechanical obligations (other kinds, or a spec origin) are
    // never auto-closed here — that would silently discharge something no graph detector raised.
    for (const o of this.all()) {
      if (o.detectorClass !== 'mechanical' || o.status !== 'open') continue
      if (o.checkerOrigin !== 'requirement-graph') continue // ingested diagnostics are closed by re-ingest
      if (!GRAPH_DETECTED_KINDS.has(o.kind)) continue // not produced by a graph detector
      const stillWanted = wanted.has(`${o.nodeId}::${o.kind}`)
      if (!stillWanted) {
        o.status = 'satisfied'
        o.lastEvaluatedAt = this.now()
        this.recordEvent(o.id, 'checker')
        discharged.push(o)
      }
    }
    return { opened, discharged }
  }

  private findOpen(nodeId: string, kind: string): RefinementObligation | undefined {
    return this.openObligations().find((o) => o.nodeId === nodeId && o.kind === kind && o.checkerOrigin === 'requirement-graph')
  }

  // ---- discharge / lifecycle -------------------------------------------

  /**
   * Discharge an obligation (close it as resolved). Enforced here, the anti-fabrication choke point:
   *   - a checker may auto-discharge ONLY a `mechanical` obligation;
   *   - a decision may discharge any decision/LLM-gated obligation, EXCEPT:
   *       (a) a raw `AI_hypothesis` guess can never discharge (a guess is not an answer),
   *       (b) a `deferred` provenance is not a close — deferrals are tracked by `defer()`, and
   *       (c) the actor must be allowed to stamp the provenance it uses — `simulated_user` can only act
   *           via `simulated_user_answer`, so it can never launder a guess into `user_confirmed`.
   * A correctly-labeled simulated stakeholder answer (the experiment's stand-in decision-maker) DOES
   * discharge — that is what lets the study produce a quality signal; it is reported as an interaction
   * *proxy*, never as a real human confirmation (task book 4.4 / 7.3).
   */
  discharge(id: string, how: DischargeHow): RefinementObligation {
    const o = this.obligations.get(id)
    if (!o) throw new ObligationError(`no obligation ${id}`)
    if (o.status !== 'open' && o.status !== 'disputed') {
      throw new ObligationError(`obligation ${id} is ${o.status}, cannot discharge`)
    }
    if (how.kind === 'checker') {
      if (o.detectorClass !== 'mechanical') {
        throw new ObligationError(
          `obligation ${id} (${o.detectorClass}) cannot be auto-discharged by a checker`,
        )
      }
      this.recordEvent(id, 'checker')
    } else if (how.kind === 'decision') {
      // (a) An LLM guess can NEVER discharge an obligation.
      if (how.decision.provenance === 'AI_hypothesis') {
        throw new ObligationError(
          `obligation ${id}: an AI_hypothesis guess cannot discharge a ${o.detectorClass} obligation`,
        )
      }
      // (b) A deferral is tracked, not closed here.
      if (how.decision.provenance === 'deferred') {
        throw new ObligationError(
          `obligation ${id}: 'deferred' is not a discharge; use defer() to track a deferral`,
        )
      }
      // (c) The actor must be allowed to stamp the provenance it uses (anti-fabrication).
      if (!isProvenanceLegal(how.decision.actorKind, how.decision.provenance)) {
        throw new ObligationError(
          `obligation ${id}: actor '${how.decision.actorKind}' may not discharge via provenance '${how.decision.provenance}'`,
        )
      }
      this.recordEvent(id, `decision:${how.decision.decisionId}:${how.decision.provenance}`)
    } else if (how.kind === 'waive') {
      if (!how.justification || !how.justification.trim()) {
        throw new ObligationError(`waiving obligation ${id} requires a justification (explicit risk acceptance)`)
      }
      this.recordEvent(id, `waived:${how.justification.slice(0, 80)}`)
    }
    o.status = how.kind === 'waive' ? 'waived' : 'satisfied'
    o.lastEvaluatedAt = this.now()
    return o
  }

  /** Defer an obligation (tracked, reversible, NOT a default approval — section 4). */
  defer(id: string, reason?: string): RefinementObligation {
    const o = this.obligations.get(id)
    if (!o) throw new ObligationError(`no obligation ${id}`)
    o.status = 'deferred'
    o.lastEvaluatedAt = this.now()
    if (reason) o.evidenceRefs.push(`defer_reason:${reason}`)
    return o
  }

  /** Mark an obligation disputed (a dependent decision was withdrawn / a conflict raised). */
  dispute(id: string, reason?: string): RefinementObligation {
    const o = this.obligations.get(id)
    if (!o) throw new ObligationError(`no obligation ${id}`)
    o.status = 'disputed'
    o.lastEvaluatedAt = this.now()
    if (reason) o.evidenceRefs.push(`dispute_reason:${reason}`)
    return o
  }

  /** Re-open a deferred/disputed obligation (used by propagation after a withdrawal). */
  reopen(id: string, reason?: string): RefinementObligation {
    const o = this.obligations.get(id)
    if (!o) throw new ObligationError(`no obligation ${id}`)
    o.status = 'open'
    o.lastEvaluatedAt = this.now()
    if (reason) o.evidenceRefs.push(`reopened:${reason}`)
    return o
  }

  private recordEvent(id: string, marker: string): void {
    const o = this.obligations.get(id)
    if (o) o.evidenceRefs.push(marker)
  }
}

/**
 * The graph-level mechanical detectors (pure, deterministic, no LLM). Each returns the set of
 * (node, kind) pairs that SHOULD have an open obligation. Reconciliation (open/close) is in detect().
 */
function mechanicalDetectors(graph: RequirementGraph): MechanicalFinding[] {
  const findings: MechanicalFinding[] = []

  // (1) cross_process_dependency_conflict — a real conflict, or an unmet dependency.
  for (const e of graph.allEdges()) {
    if (e.kind === 'conflicts_with') {
      const a = graph.getNode(e.source)?.title ?? e.source
      const b = graph.getNode(e.target)?.title ?? e.target
      findings.push({
        nodeId: e.source,
        kind: 'cross_process_dependency_conflict',
        description: `conflict: "${a}" conflicts_with "${b}"; a trade-off decision is required`,
        evidenceRefs: [e.id, e.source, e.target],
      })
    } else if (e.kind === 'depends_on') {
      const target = graph.getNode(e.target)
      if (target && (target.status === 'invalidated' || target.status === 'blocked')) {
        const src = graph.getNode(e.source)?.title ?? e.source
        findings.push({
          nodeId: e.source,
          kind: 'cross_process_dependency_conflict',
          description: `unmet dependency: "${src}" depends_on "${target.title}" which is ${target.status}`,
          evidenceRefs: [e.id, e.source, e.target],
        })
      }
    }
  }

  // (2) acceptance_scenario — an atomic process/module with no linked testable scenario.
  for (const n of graph.allNodes()) {
    if (n.nodeType !== 'process_ref' && n.nodeType !== 'module_ref') continue
    const hasScenario = graph
      .allNodes()
      .some((c) => c.nodeType === 'acceptance_scenario' && graph.parent(c.id)?.id === n.id)
    if (hasScenario) continue
    // A satisfies/traces_to edge to an acceptance scenario also counts.
    const hasLinked = graph.allEdges().some((e) => {
      if (e.source !== n.id || (e.kind !== 'satisfies' && e.kind !== 'traces_to')) return false
      const t = graph.getNode(e.target)
      return t?.nodeType === 'acceptance_scenario'
    })
    if (hasLinked) continue
    findings.push({
      nodeId: n.id,
      kind: 'acceptance_scenario',
      description: `atomic process "${n.title}" has no acceptance scenario`,
      evidenceRefs: [n.id],
    })
  }

  // (3) data_state_update — a data requirement not bound to a concrete artifact (unbound write).
  for (const n of graph.allNodes()) {
    if (n.nodeType !== 'data_ref') continue
    if (n.artifactRefs.length === 0) {
      findings.push({
        nodeId: n.id,
        kind: 'data_state_update',
        description: `data requirement "${n.title}" is not bound to a concrete data artifact (unbound write)`,
        evidenceRefs: [n.id],
      })
    }
  }

  return findings
}
