# STATUS — Effort-Aware Refinement Research

**Branch:** `research/effort-aware-refinement` · **Baseline commit:** `8f325df`
**Last updated:** 2026-10-31 (P1 + P2 + P3 + **P4 core done/green** at `094bfcb`; P4 thin Studio tools remaining)

## Phase gates

| Phase | Gate | Status |
|---|---|---|
| **P0** | Baseline report + arch map + branch + research dir + reproducible build/test | ✅ **DONE** |
| **P1** | Literature + novelty assessment + RQ freeze | ✅ **DONE** — **REVISE** decision (cost-aware selection = prior art [SAGE-Agent]; claim re-scoped to the joint over a verified hybrid spec) |
| **P2** | Conceptual model + semantic design + ADRs | ✅ **DONE** (`conceptual-model.md` finalized vs §4; ADR-004) |
| **P3** | Refinement tree/graph infra + tests-first (stable) | ✅ **DONE** (`b110284`; 107 tests green; 1199-test floor holds) |
| **P4** | Agent harness + human decision loop | 🟡 **CORE DONE** (`094bfcb`: `RefinementSession` + 6 §6.6 gate replay tests); thin Studio tools + `exp-freeze-v1.3` remaining |
| P5 | Benchmark + oracle + baselines + preregistration | ⬜ |
| P6 | Run experiments (authorized free model) + diagnose | ⬜ |
| P7 | User study protocol (design-only; no fabricated participants) | ⬜ |
| P8 | LaTeX paper draft + claims audit | ⬜ |
| FINAL | Research report + handoff | ⬜ |

## P0 — completed
- Cloned `agile-sofl-toolchain` at `8f325df`, created branch `research/effort-aware-refinement`.
- Created `research/effort-aware-refinement/` workspace.
- Deep read-only audit of all 7 packages (parser, gui, aspec, editor-api, language-server, vscode,
  studio) — see `design/architecture.md`.
- `npm ci` → exit 0. `npm run build` → exit 0. `npm test` → 1092 passed, **5 pre-existing failures**
  (all in studio: 4× environmental Electron-binary-missing, 1× pre-existing prompt-content assertion
  in `llmPromptsFsf.test.ts`). See `baseline-report.md`.
- Key finding: the toolchain **already** has (a) a complete atomic-requirement refinement model with
  dual-line ambiguity counters + audit log (docs 25/26, `editor-api/refinement.ts`), (b) a mature LLM
  agent with `ask_clarification`/`propose_refinement_step`/`read_refinement_state`, a post-clarify read
  budget, permission gates, an experiment-condition system (T/B2) + telemetry, and (c) a trace-link
  provenance system. The research increment must build **on** this, not duplicate it.
- Identified the research gap (§5 of architecture.md): no requirement-level typed structure, no
  cost-aware question-selection policy, no first-class obligation entities, no readiness policy, no
  benchmark/oracle/baselines.

## P1 — completed so far
- Confirmed B1 is a true environmental blocker (electron `dist` incomplete) and the **headless
  experiment harness is usable here** (`tests/agentHarness.test.ts` mocks electron and passes).
- Full read-only audit of the experiment harness (`scripts/agent-harness/`): `Condition =
  'T'|'B2'|'B0-auto'`; block-randomized seeded schedule; 429/503 backoff; resume + `--stop-at`;
  blinded outputs; `resolveClarification` oracle hook; offline `--dry-run` fake-LLM path;
  `promptHash` fairness; `UNMATCHED_CLARIFICATION_REPLY` anti-fabrication. B0-auto =
  `refineAspecWithCheck` (no LLM). **Freeze guard** (`freeze.ts`): `TOOL_PATHS` covers
  `packages/studio/src`, so P4's new agent tools will require a **new freeze tag** (e.g.
  `exp-freeze-v1.3`); `packages/refinement` is not in `TOOL_PATHS`.
- Audited the two reference benchmark tasks (`classroom.aspec`, `delivery-trimmed.aspec`): both have
  state machines, cross-process constraints, role boundaries, and time/idempotency boundaries that
  exercise gaps G1–G7.
- Wrote `research/novelty-assessment.md`: internal prior-work boundary verified from source (I1–I8,
  gap G1–G7); external-literature rows marked PENDING (no citation invented); interim GO +
  REVISE/PIVOT triggers.
- Wrote `research/hypotheses-and-preregistration.md`: frozen RQ1–RQ3 (RQ4 supplementary), DV
  operational definitions, pre-registered quality floor, task/oracle schema with anti-fabrication
  invariants, statistical plan, exclusion rules, free-API-only run plan.

## Blockers (see BLOCKERS.md)
- Electron binary not installed in sandbox (4 studio tests fail environmentally). Non-blocking for the
  research core (parser/aspec/editor-api + headless agent harness).
- (transient) harness command-safety classifier flapping — retries succeed; read-only tools unaffected.

## P1 — completed (gate passed, REVISE)
- Literature agent returned **verified** citations (Crossref/arXiv/ACL). Wrote `literature-matrix.csv`
  + `literature-notes.md`; filled novelty-assessment §3–§5.
- **Pivotal finding:** SAGE-Agent (Findings of ACL 2026) already implements cost-aware EVPI−Cost
  question selection → the **selection mechanism is prior art** (adopted + cited, not claimed novel).
- **REVISE decision recorded** (task book §3.4): re-scope the claim to the **joint** (typed structure +
  detector-classified obligations + decision provenance + readiness policy + cross-node decision
  propagation) over a **verified hybrid Agile-SOFL spec**. Appended v2 to the frozen preregistration
  (re-scopes RQ1 DVs + RQ3 baseline; no metric/threshold/comparison change). **P3 is unblocked.**

## P2 — completed
- `conceptual-model.md` finalized against task book §4 (domain event flow, per-obligation
  detector/discharge table, lifecycle completion semantics, serialization/migration, placement).
  `DECISIONS.md` ADR-004 fixes component placement + freeze-guard implication.

## P3 — completed (gate passed)
- **New headless package `@agile-sofl/refinement`** (tests-first, commit `b110284`), the requirement-level
  typed structure ABOVE the process tree:
  - `graph`: `RequirementGraph` — `refines` tree (AND/OR/OPTIONAL/n_of_m) + typed cross-links
    (`depends_on`/`constrains`/`conflicts_with`/`satisfies`/`traces_to`); invariants INV-1..INV-5
    (no refines cycles, no dangling refs, unique ids, single parent); **iterative** traversals (safe to
    10k-node trees — perf-tested at 100/1k/10k).
  - `obligations` (**core contribution**): first-class detector-classified obligations
    (`mechanical`/`llm_candidate`/`user_decision`). `discharge()` is the single anti-fabrication choke
    point: checker closes only `mechanical`; a decision must (a) not be an `AI_hypothesis` guess, (b) not
    be a deferral, (c) use a **legal actor→provenance pairing** — `simulated_user` can only stamp
    `simulated_user_answer`, so it can NEVER launder a guess into `user_confirmed`. A correctly-labeled
    simulated answer legitimately discharges (the experiment's stand-in / interaction proxy, per task
    book §4.4/§7.3).
  - `provenance`: the single enforcement point for the actor→provenance table (`assertProvenance`).
  - `decisions`: `DecisionStore` — `record` (asserts provenance, rejects `AI_hypothesis`) + `withdraw`
    propagation (re-opens satisfied/**waived/deferred** obligations, demotes grounded confirmed nodes to
    `needs_clarification` — **never silently re-approves**); `computeImpactSet` (transitive dependents +
    constrains targets + refines subtree).
  - `selector`: cost-aware clarification selection (SAGE-Agent EVPI−Cost form, `benefit/(cost+ε)` +
    high-impact-policy min-risk gate; **hypothesis under test RQ3, not claimed novel**).
  - `readiness`: verdicts `READY`/`NEEDS_CLARIFICATION`/`DEFERRED`/`BLOCKED`/`INCOMPLETE_WITH_RISK`;
    budget exhaustion is a **STOP, never a pass** (task book §6.5).
  - `lifecycle` (node state machine incl. ready→needs_clarification), `events` (append-only dense-
    sequenced replayable `EventLog`), `serialize` (`schemaVersion=1`, additive migration → `extensions`,
    crash recovery, expected-version gate, **future-version rejection**, round-trip invariants).
- **Tests:** 107 green (unit + property 400-op random trees + replay/determinism + 3 §12 e2e scenarios +
  perf). Root `build`/`test` workspace chains updated.
- **Baseline floor holds:** full `npm test` → 1321 passing at the 107-refinement point (per-workspace
  sum; the "1199" first recorded here was a miscount of that same breakdown), same 5 pre-existing
  studio failures, **zero new failures**. `tsc` clean.

## P4 — core completed (`RefinementSession` + §6.6 gate replay tests; commit `094bfcb`)
- **`RefinementSession`** (`packages/refinement/src/session.ts`) — the single **headless, deterministic,
  typed domain-tool + turn-orchestration** layer (task book §6.1 — **NOT a second agent system**). The
  Studio agent / experiment harness consume it as **thin wrappers** (no logic duplication). Lives in
  `packages/refinement` → **freeze-guard-safe** (no new tag needed) + **Electron-free** (testable here).
  Tools: `readRefinementTree`, `proposeRefinement` (AI_hypothesis candidates, never user_confirmed),
  `checkObligations`, `listOpenObligations`, `selectNextClarification` (cost-aware; answered obligations
  never re-asked), `recordDecision` (isolated actor; confirm/answer discharges + honest source, defer
  tracks a deferral, unknown/reject fabricates nothing; `supersedes` re-evaluates the **full impact set**
  and pulls dependents back to `needs_clarification` — **no auto re-approval**),
  `proposeRevision`/`applyRevision` (version-gated; stale proposals **REJECTED, not silently overwritten**),
  `assessReadiness`, `runTurn` (deterministic turn loop; budget exhaustion = a stop).
- **The six §6.6 gate replay tests** (`tests/session-gate.test.ts`) — each run **twice with deterministic
  id generators** to prove replay determinism: (1) coarse→confirm→multi-round refine→READY; (2) `unknown`
  → **no fabricated rule** (obligation stays open, node stays AI_hypothesis/draft, scope not ready, not
  re-asked); (3) `defer` → risk preserved (DEFERRED) + a non-blocking branch continues; (4) changing a
  prior rule → dependent invalidated/re-evaluated (needs_clarification), **no auto re-approval**, original
  decision withdrawn; (5) a version-stale agent edit → **REJECTED** (a fresh proposal at the current
  version applies); (6) a never-resolving stakeholder → each decision asked **at most once**, loop
  terminates on "no eligible candidate" with budget left. + 2 supplementary anti-fabrication tests (a
  correctly-labeled `simulated_user`+`simulated_user_answer` answer discharges as a proxy but can **never**
  launder a node into `user_confirmed`).
- **Tests:** refinement **115 green** (107 + 8); `tsc` + `build` clean. **Full `npm test` → 1329 passing /
  5 failing** (verified per-workspace: parser 493, refinement 115, gui 23, aspec 46, editor-api 196,
  language-server 50, vscode 84, studio 322) — the **5 are the same pre-existing** studio failures
  (4 environmental Electron + 1 `llmPromptsFsf` "implies"), **zero new**.
- **Remaining P4 (touches `packages/studio`):** wire the 5 **thin** agent tools over `RefinementSession`
  + add the studio dep + cut `exp-freeze-v1.3`. Gate scenario #7 (real `.asfl` fixtures pass the language
  checks) is the studio/parser layer, exercised in P5/P6.

## Next actions
1. **P4 (REMAINING):** wire `RefinementSession` as **thin** Studio agent tools — `read_requirement_graph`,
   `list_obligations`, `select_next_clarification`, `record_decision`, `assess_readiness` — following the
   `HybridAgentBootstrapPayload` pattern in `packages/studio/src/renderer/lib/refineAgentTools.ts` + tool
   registration in `main/services/llm/agentLoop.ts` (each a thin call into the session; `record_decision`
   passes the actor explicitly — never the agent impersonating the user). Add `@agile-sofl/refinement` to
   studio deps; `tsc` clean + full `npm test` green (1329 floor); then cut `exp-freeze-v1.3`.
2. **P5:** simulated-stakeholder **oracle** as a `resolveClarification` hook (harness `core.ts:52`) driving
   `RefinementSession.runTurn`; extend `Condition` to A/B/C/D + ablations (SAGE-Agent EVPI−Cost as the RQ3
   baseline); scorer + prereg check; smoke + pilot on the offline `--dry-run` fake-LLM path first.
3. **P6:** run on the two authorized FREE APIs (both confirmed reachable; ECNU `ecnu-max` =
   `deepseek-v4-flash`); diagnose; iterate (no test-set overfitting).
4. Paper (P8): cite SAGE-Agent + the others per `literature-notes.md`; RE 2026 = double-blind, 10+2 pages.
