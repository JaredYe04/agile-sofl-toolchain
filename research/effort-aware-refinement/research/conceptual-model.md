# Conceptual Model — Requirement-Level Refinement (DRAFT, P2; final after P1 gate)

**Status:** DRAFT. Grounded in the P0 audit of the existing toolchain. Confirms the *minimal* typed
structure needed to support the frozen RQs — explicitly **not** a full KAOS / Feature-Model system
(task book §4.1). Finalized after `novelty-assessment.md`.

## 1. Two-layer structure (primary tree + typed cross-links)

The existing toolchain has a **formal process-decomposition tree** (module → process → decom → child
module; see `editor-api/moduleGraph.ts`, `parser/refine/atomicity.ts`) and a **flat informal list**
(functions / data / constraints; `aspec` `InformalModule`). These are *linked* today only by the
`TraceabilityGraph` (`refines/constrains/uses` links). 

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
- **AND/OR/optional** decomposition semantics on `refines` edges (KAOS-style, minimal subset).
- **Invariants (must hold, testable):** no cycles in `refines`; no dangling edge endpoints; unique
  stable IDs (UUIDs); every node has a version; tree depth / child count is **not** a completion metric.

## 2. Domain entities (draft; names are design, will be mapped to real code)

### `RequirementNode`
- `id` (stable UUID), `nodeType` ∈ {`system_goal`, `goal`, `capability`, `user_story`, `feature`,
  `module_ref`, `process_ref`, `data_ref`, `constraint`, `non_functional_goal`, `acceptance_scenario`},
  `title`, `description`, `scope`, `parentId?`, `ordering`, `version`, `source` (provenance),
  `owner?`, `status` (lifecycle, §4), `priority`/`criticality`, `artifactRefs` (links to existing
  informal node id / hybrid AST id / GUI screen id — **references, not duplicates**).

### `RefinementEdge`
- `id`, `source`, `target`, `kind` (typed edge list above), `decompositionSemantics` ∈
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

Candidate obligation kinds (minimal set, per node type):
- **goal_decomposition_coverage**: can the parent goal be reasonably supported by the children's
  combination (AND/OR satisfied)?
- **precondition_input_constraint** / **postcondition_observable_behavior**: present and consistent?
- **data_state_update**: which state/data is written; consistent with `constrains` links?
- **failure_path** / **boundary_condition**: exception and boundary behavior specified?
- **role_permission**: who may perform; role scope confirmed (not defaulted)?
- **cross_process_dependency_conflict**: `depends_on`/`conflicts_with` resolved, no unmet dependency?
- **acceptance_scenario**: at least one testable scenario per atomic process?
- **policy_confirmation**: high-impact business policy confirmed by an authorized actor?

**Each obligation must specify:** detector, evidence, false-positive risk, discharge condition, and a
test. We do **not** claim a checker proves semantic completeness of natural-language requirements
(task book §4.4). The obligation is *obligation closure* under the tool's rules, not a correctness
proof (consistent with the existing atomic-requirement semantics, docs/25).

## 4. Node lifecycle (explicit state machine, testable)

`draft → needs_clarification → ready`, with `deferred`, `blocked`, `invalidated`. A change can move a
`ready` node back to `needs_clarification` (via dependency propagation). Transitions are explicit and
unit-tested (not a frontend color).

## 5. Decision provenance (anti-fabrication; a hard requirement)

Every node/decision/obligation-discharge carries a status:
`AI_hypothesis` | `source_text_observation` | `user_confirmed` | `simulated_user_answer` |
`analyst_approved` | `deferred`. **An LLM guess can NEVER be set to `user_confirmed`.** In automated
experiments, simulated answers are `simulated_user_answer` and are reported as interaction *proxies*,
not real cognitive load.

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
- A **user story ≠ a SOFL process** (may be 1:many/many:1); the mapping is an explicit `refines`/
  `traces_to` edge, not an identity.
- Do not force every high-level feature into formal pre/post code; the stricter existing Agile-SOFL
  conventions are respected (docs/17). Differences are recorded.
- Mutations to the spec go through the **existing structured editor APIs / typed tools**
  (`propose_hybrid_changes`, `propose_refinement_step`), not raw unvalidated strings.
- Generated formal specs **must pass the existing Parser/Checker**; unparseable output stays a
  proposal with a fix hint. The new data structures never break the existing AST/Parser.

## 9. Minimal vertical slice (P3 target)

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

## 10. End-to-end scenarios (draft; final in P2)

1. **Booking cancellation**: state, time boundary, refund policy → confirm cancellation window;
   unknown window → defer; user withdraws a rule → dependent nodes re-evaluated.
2. **Order/refund**: cross-process data consistency (inventory vs order) → `constrains` links to two
   processes; a conflicting refund policy → `conflicts_with` + user decision.
3. **Permission change**: role scope change → `role_permission` obligations on multiple processes
   invalidated → re-confirm; a defaulted allow/deny mapping flagged as `AI_hypothesis`, not confirmed.

Each scenario includes: undecided state, withdrawal, branch conflict, and a version-conflict proposal.

## 11. Test case list (draft; to be written tests-first in P3)

- **Unit:** CRUD, ID uniqueness, move subtree, cycle prevention, orphan prevention, type checks,
  AND/OR semantics, ordering, state transitions, invariants, change-impact set.
- **Property/random:** random trees + cross-links + random op sequences → invariants hold (no cycles,
  no dangling refs, no bad state transitions, serialization consistency).
- **Serialization/migration:** empty/deep/wide trees, non-ASCII Chinese, old-version projects,
  crash recovery, partially corrupt input, version conflict, unauthorized edit.
- **Contract:** editor-API DTOs, agent tool input/output schemas, error diagnostics, approval responses.
- **Integration:** requirement node ↔ informal/hybrid/process links; read/write via existing
  parser/checker; old Studio ops unaffected.
- **UI/E2E:** tree nav, expand/collapse, candidate preview, accept/reject/edit/defer, persist + reopen
  (headless where possible; otherwise Playwright/Electron script with reported limitations).
- **Performance:** synthetic trees at 100 / 1,000 / 10,000 nodes → query, modify, save, affected-subgraph
  compute; avoid full recompute per edit. (Sizes are test parameters, not product SLOs.)
