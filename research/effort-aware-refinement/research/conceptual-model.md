# Conceptual Model — Requirement-Level Refinement (P2 design; implementation in P3)

**Status:** P2 DESIGN, finalized against task book §4. It tracks the **frozen** RQs
(`hypotheses-and-preregistration.md`). It is a design, not code; P3 implements it tests-first. The
overall research GO/REVISE decision (P1) does not change this design: the structure, obligations,
readiness, and selector are reusable under all three outcomes (task book §3.4).

This is the **minimal** typed structure needed to support the frozen RQs. It is explicitly **not** a full
KAOS / Feature-Model system (task book §4.1): we implement only the subset the research actually needs.

## 1. Two-layer structure (primary tree + typed cross-links)

The existing toolchain has a **formal process-decomposition tree** (module → process → decom → child
module; `editor-api/moduleGraph.ts`, `parser/refine/atomicity.ts`) and a **flat informal list**
(functions / data / constraints; `aspec` `InformalModule`). Today they are linked only by the
`TraceabilityGraph` (`refines` / `constrains` / `uses`).

We add a **requirement-level refinement layer ABOVE** the process tree, with **typed cross-links**:

```
SYSTEM goal
├── domain goal / capability
│   ├── user story / feature
│   │   ├── (sub-story)
│   │   └── process (links to hybrid process via refines)
│   └── constraint (cross-links: constrains → several processes)
└── non-functional goal (cross-links: constrains → several features)
```

- **Primary hierarchy** (`RefinementEdge kind = refines`): system goal → domain goal/capability →
  user story/feature → module/function/process → contract/acceptance scenario.
- **Typed cross-links** (independent of the tree): `refines`, `depends_on`, `constrains`,
  `conflicts_with`, `satisfies`, `traces_to`. A constraint or non-functional goal may `constrains`
  many nodes (many-to-many), which a tree cannot express.
- **AND/OR/optional/n_of_m** decomposition semantics on `refines` edges (KAOS-style, minimal subset),
  plus **mutual-exclusion** via `conflicts_with` and `n_of_m`.
- **Heterogeneous, uneven levels:** levels do not have to align, and node types differ by level. **Depth
  does not make a node an executable process** — a feature three levels down is still a feature until an
  explicit `refines` edge points it to a concrete process.
- **Invariants (must hold, testable):** no cycles in `refines`; no dangling edge endpoints; unique
  stable IDs (UUIDs, so a name collision is never an identity collision); every node has a version;
  tree depth / child count is **not** a completion metric.

## 2. Domain entities (design; mapped to real code in P3)

### `RequirementNode`
- `id` (stable UUID), `nodeType` ∈ {`system_goal`, `goal`, `capability`, `user_story`, `feature`,
  `module_ref`, `process_ref`, `data_ref`, `constraint`, `non_functional_goal`, `acceptance_scenario`},
  `title`, `description`, `scope`, `parentId?`, `ordering`, `version`, `source` (provenance),
  `owner?`, `status` (lifecycle, §4), `priority`/`criticality`, `artifactRefs` (links to existing
  informal node id / hybrid AST id / GUI screen id — **references, not duplicates**).

### `RefinementEdge`
- `id`, `source`, `target`, `kind` (the typed list above), `decompositionSemantics` ∈
  {`AND`, `OR`, `OPTIONAL`, `n_of_m`}, `evidence?`, `version`.

### `RefinementObligation` (the core, §3)
- `id`, `nodeId`, `kind`, `description`, `severity` (critical/major/minor), `status`
  (open/satisfied/disputed/deferred/waived), `detectorClass` (mechanical / llm_candidate /
  user_decision), `evidenceRefs`, `checkerOrigin`, `policyRequired` (bool), `lastEvaluatedAt`.

### `RequirementDecision`
- `decisionId`, `targetNodeIds?`, `obligationIds?`, `question`, `options?`, `freeText?`, `answer`,
  `actorKind` ∈ {`user`, `authorized_decider`, `simulated_user`}, `provenance` (§5), `status`,
  `timestamp`, `justification?`, `supersedes?` (decision versioning).

### `ClarificationCandidate`
- `id`, `targetNodeIds`, `obligationIds`, `question`, `choiceOptions?`, `supportsFreeText` (default
  true), `supportsUnknown`, `supportsDefer`, `supportsNoneOfAbove`, `estimatedBenefit` (expected
  quality gain), `estimatedHumanCost` (effort proxy), `priorityReason`, `eligibleState`.

### `RequirementRevision`
- `id`, `before`/`after` (node/edge/obligation snapshots), `changedObjects`, `affectedGraph`
  (computed impact set), `approvedBy`, `origin` (agent/analyst/user), `version`, `undoMetadata`.

### `ReadinessAssessment`
- `id`, `scope`, `targetStage`, `unresolvedCriticalObligations`, `deferredObligations`,
  `checkerDiagnostics`, `decisionProvenance`, `verdict` (§6), `reason`.

## 3. Refinement obligations (typed, explainable) — the core contribution

Each obligation has a **detector class** (the critical distinction, task book §4.4):
1. **Mechanically detectable** (deterministic checker, testable, no LLM): missing required fields,
   unbound references, dangling edges, cycles, known type conflicts, a constraint `constrains` a node
   that does not exist, an obligation whose discharge evidence is absent.
2. **LLM-assisted candidate** (candidate alert ONLY, must be confirmed or dismissed by a decision):
   possibly missing exception/failure path, parent–child intent inconsistency, ambiguous business term,
   a high-impact policy stated as a default rather than a confirmed decision.
3. **User decision required** (cannot be auto-discharged): policy boundaries, business priority,
   scope inclusion, conflicting-requirement trade-offs.

Candidate obligation kinds (minimal set, per node type) and their detector / discharge / test focus:

| Obligation kind | Detector class | Discharge condition | Test focus |
|---|---|---|---|
| `goal_decomposition_coverage` (parent supported by children's AND/OR combination) | llm_candidate | a user/analyst decision confirms the combination suffices, or the gap is explicitly waived | a parent with an uncovered AND child stays open; OR needs one satisfied branch |
| `precondition_input_constraint` | mechanical + llm_candidate | required inputs present & typed; LLM candidate (ambiguity) confirmed/dismissed | missing/untyped input → open; well-formed input → satisfied |
| `postcondition_observable_behavior` | llm_candidate | observable effect stated & confirmed; no silent side effect unaccounted for | post with no observable effect → candidate |
| `data_state_update` | mechanical | which state/data is written; consistent with `constrains` links | a write to an unbound entity → open |
| `failure_path` / `boundary_condition` | llm_candidate | exception/boundary behavior specified & confirmed | no failure path on a mutating process → candidate |
| `role_permission` | mechanical + user_decision | role scope confirmed (not defaulted) by an authorized actor | a defaulted allow/deny stays `AI_hypothesis`, not confirmed |
| `cross_process_dependency_conflict` | mechanical | `depends_on`/`conflicts_with` resolved, no unmet dependency | a dangling `depends_on` or a real conflict → open |
| `acceptance_scenario` | mechanical | at least one testable scenario per atomic process | an atomic process with no scenario → open |
| `policy_confirmation` | user_decision | high-impact policy confirmed by an authorized actor | high-impact policy with no confirmation → open |

**Each obligation must specify:** detector, evidence, false-positive risk, discharge condition, and a
test. We do **not** claim a checker proves semantic completeness of natural-language requirements
(task book §4.4). An obligation is *obligation closure* under the tool's rules, not a correctness proof
(consistent with the existing atomic-requirement semantics, docs/25).

## 4. Node lifecycle (explicit state machine, testable)

`draft → needs_clarification → ready`, with `deferred`, `blocked`, `invalidated`. A change can move a
`ready` node back to `needs_clarification` (via dependency propagation). Transitions are explicit and
unit-tested (not a frontend color).

Completion semantics (task book §4.3):
- `ready` is relative to the **current task scope, level, critical constraints, and the active checker
  rules** — it is not "more detailed is better."
- `ready` is readiness **under the given check framework and user confirmation**, not a mathematical
  proof that the requirement is complete.
- `deferred` is **not** a default approval and **must not** silently enter code implementation; it is a
  tracked, reversible state with a reason.
- Every key state transition is traceable (emitted as a domain event, §9, and logged).

## 5. Decision provenance (anti-fabrication; a hard requirement)

Every node/decision/obligation-discharge carries a status:
`AI_hypothesis` | `source_text_observation` | `user_confirmed` | `simulated_user_answer` |
`analyst_approved` | `deferred`. **An LLM guess can NEVER be set to `user_confirmed`.** In automated
experiments, simulated answers are `simulated_user_answer` and are reported as interaction *proxies*,
not real cognitive load (task book §7.3).

## 6. Readiness policy (explicit stop mechanism)

Verdicts: `READY` | `NEEDS_CLARIFICATION` | `DEFERRED` | `BLOCKED` | `INCOMPLETE_WITH_RISK`.
`READY` requires, within scope: all critical obligations satisfied **or** explicitly risk-accepted, all
required decisions confirmed, no blocking checker diagnostics, and a met readiness policy. Budget
exhaustion or "no more candidates" does **not** alone imply `READY` (task book §6.5).

## 7. Cost-aware question selection (draft policy; to be tested, not assumed)

`priority(q) = expected_quality_gain(q) / (estimated_user_effort(q) + ε)`, with an explicit
**minimum-risk gate** for high-impact policy questions (not ignored by the division). Inputs:
# unresolved critical obligations addressed; criticality + cross-node impact of target nodes;
whether it is a blocking prerequisite; # prior re-asks; question complexity / # options / domain-knowledge
need; the user's stated clarification budget & current stage.

`expected_quality_gain` and `estimated_user_effort` are **heuristic estimates to be calibrated**; the
policy is a *hypothesis to be tested* (RQ3 ablation), not an established theory. In the benchmark,
`estimated_user_effort` is the agent's estimate; the *measured* cost is the actual interaction count
from the simulated stakeholder.

## 8. Relationship to Agile-SOFL semantics (reuse, don't break)

- Reuse existing `.aspec` (informal) + `.asfl` (hybrid) + GUI objects and the parser/checker.
- A **user story ≠ a SOFL process** (may be 1:many/many:1); the mapping is an explicit `refines` /
  `traces_to` edge, not an identity.
- Do not force every high-level feature into formal pre/post code; the stricter existing Agile-SOFL
  conventions are respected (docs/17). Differences are recorded.
- Mutations to the spec go through the **existing structured editor APIs / typed tools**
  (`propose_hybrid_changes`, `propose_refinement_step`), not raw unvalidated strings.
- Generated formal specs **must pass the existing Parser/Checker**; unparseable output stays a
  proposal with a fix hint. The new data structures never break the existing AST/Parser.

## 9. Domain event flow (design acceptance, task book §4.6)

Events are the traceable record of every key transition (§4 "all transitions traceable") and the
triggers for propagation and readiness recomputation. Emitted by the core, consumed by Studio (UI/
telemetry) and the harness (study events):

| Event | Emitted when | Effect |
|---|---|---|
| `node_created` / `node_updated` / `node_moved` / `node_soft_deleted` | CRUD | recompute invariants; affected-subgraph query |
| `edge_added` / `edge_removed` | cross-link change | cycle/dangling recheck; dependency graph updated |
| `obligation_opened` | checker/LLM-candidate raises an open obligation | node → `needs_clarification` if critical |
| `obligation_discharged` | discharge condition met (decision/mechanical) | may unblock node |
| `decision_recorded` | a candidate is answered (provenance set) | discharge linked obligations; provenance update |
| `decision_withdrawn` | user withdraws/supersedes a decision | **propagation:** dependent obligations re-open, dependent nodes → `needs_clarification` (never silently re-approved) |
| `propagation_invalidate` | a change affects dependent nodes | recompute affected graph; emit per-node status change |
| `readiness_recomputed` | any of the above within scope | update `ReadinessAssessment` verdict |
| `revision_applied` | an approved `RequirementRevision` lands | before/after snapshots + undo metadata stored |

The event stream is append-only and replayable (P3/P4 replay tests depend on this).

## 10. Compatibility, serialization, and version migration

- **Old projects without a tree still open** (no forced lossy migration): the requirement layer is
  optional; absence is a valid state, not an error.
- **Schema versioning** on the persisted graph (`workspace-vN.json`-style, mirroring the existing
  trace `workspace-v3.json`); each node/edge carries its own `version`; a `schemaVersion` field on the
  document drives migration.
- **Migration is additive and reversible:** new node types / edge kinds are introduced as
  backward-compatible extensions; unknown fields are preserved, not dropped (crash-recovery safe).
- **Serialization round-trip is a tested invariant:** empty / deep / wide trees, non-ASCII (Chinese)
  content, old-version documents, partially corrupt input, version conflict, unauthorized edit all have
  tests (see §13).
- The persisted requirement graph is a **separate artifact** from the spec text (`.asfl`) and the trace
  graph; node `artifactRefs` are the join points, so none of these can silently corrupt the others.

## 11. Minimal vertical slice (P3 target)

1. Create/read/modify/reorder/soft-delete/restore requirement nodes; typed parent-child constraints.
2. Typed cross-links + basic consistency diagnostics (cycles, dangling, duplicate IDs).
3. Tree + detail data contract (simple UI later).
4. Link existing module/function/process/GUI/hybrid objects by reference.
5. Persist across save/close/reopen (IDs, relations, decisions, approvals survive).
6. Node/subtree queries + change-impact query.
7. Undo/redo (or equivalent tracked rollback); handle concurrent/stale proposals (expected version).
8. Old projects without a tree still open (no forced lossy migration).
9. Import/export schema versioning + basic compatibility.
10. Deterministic obligation checker + cost-aware selector + readiness assessment (the research core).

## 12. End-to-end scenarios (final; drive P5 tasks + P3 tests)

Each scenario includes an **undecided state**, a **withdrawal**, a **branch conflict**, and a
**version-conflict proposal**.

1. **Booking cancellation:** state, time boundary, refund policy → confirm cancellation window;
   unknown window → defer; user withdraws a rule → dependent nodes re-evaluated (`propagation_invalidate`).
2. **Order/refund:** cross-process data consistency (inventory vs order) → `constrains` links to two
   processes; a conflicting refund policy → `conflicts_with` + a `policy_confirmation` user decision
   (branch conflict). Maps directly to the existing `delivery-trimmed.aspec` task.
3. **Permission change:** role scope change → `role_permission` obligations on multiple processes
   invalidated → re-confirm; a defaulted allow/deny mapping flagged as `AI_hypothesis`, not confirmed
   (version-conflict proposal: two actors propose different scopes).

## 13. Test case list (written tests-first in P3)

- **Unit:** CRUD, ID uniqueness, move subtree, cycle prevention, orphan prevention, type checks,
  AND/OR/optional/n_of_m semantics, mutual exclusion, ordering, state transitions (every §4 transition
  incl. ready→needs_clarification via propagation), invariants, change-impact set.
- **Obligations:** one test per §3 table row (each obligation opens under its trigger and discharges
  under its condition); detector-class correctness (mechanical never needs an LLM; user_decision never
  auto-discharges); `policy_confirmation`/`role_permission` stay `AI_hypothesis` until confirmed.
- **Propagation:** a withdrawn decision re-opens dependents and does **not** silently re-approve them;
  the affected graph matches the computed set.
- **Property/random:** random trees + cross-links + random op sequences → invariants hold (no cycles,
  no dangling refs, no bad state transitions, serialization consistency).
- **Serialization/migration:** empty/deep/wide trees, non-ASCII Chinese, old-version projects,
  crash recovery, partially corrupt input, version conflict, unauthorized edit.
- **Contract:** editor-API DTOs, agent tool input/output schemas, error diagnostics, approval responses.
- **Integration:** requirement node ↔ informal/hybrid/process links; read/write via existing
  parser/checker; old Studio ops unaffected.
- **Replay:** the §9 event stream replayed from an empty state reconstructs the same final graph +
  readiness (deterministic).
- **UI/E2E:** tree nav, expand/collapse, candidate preview, accept/reject/edit/defer, persist + reopen
  (headless where possible; otherwise Playwright/Electron script with reported limitations).
- **Performance:** synthetic trees at 100 / 1,000 / 10,000 nodes → query, modify, save,
  affected-subgraph compute; avoid full recompute per edit. (Sizes are test parameters, not product SLOs.)

## 14. Where each piece lives (P2 ADR summary — full text in DECISIONS.md)

- **New headless package `packages/refinement`** (ADR-001): the typed graph, obligation checker,
  cost-aware selector, readiness assessment, lifecycle state machine, event stream, and
  serialization/migration. Pure, deterministic, no Electron → unit/property/replay-testable.
- **Studio (agent layer)** (ADR-002/003): thin agent tools that call into `packages/refinement`
  (`read_requirement_graph`, `list_obligations`, `select_next_clarification`,
  `record_decision`, `assess_readiness`) — the agent **proposes**, a decision **records** provenance;
  the agent never auto-sets `user_confirmed`.
- **Experiment harness**: consumes the selector + readiness to drive conditions A/B/C/D + ablations
  (P5), reusing `runOnce` + the `resolveClarification` oracle hook.
