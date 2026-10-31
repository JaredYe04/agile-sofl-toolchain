# STATUS — Effort-Aware Refinement Research

**Branch:** `research/effort-aware-refinement` · **Baseline commit:** `8f325df`
**Last updated:** 2026-11-01 (P1–P5 **DONE** — P5: oracle `ef82d3d`, harness threading `ca25534`, scorer `8a999e7`, deterministic A/B/C/D driver + gate test `e894f1b`, 3-task pilot set `1e12d2b`; P6 next)

## Phase gates

| Phase | Gate | Status |
|---|---|---|
| **P0** | Baseline report + arch map + branch + research dir + reproducible build/test | ✅ **DONE** |
| **P1** | Literature + novelty assessment + RQ freeze | ✅ **DONE** — **REVISE** decision (cost-aware selection = prior art [SAGE-Agent]; claim re-scoped to the joint over a verified hybrid spec) |
| **P2** | Conceptual model + semantic design + ADRs | ✅ **DONE** (`conceptual-model.md` finalized vs §4; ADR-004) |
| **P3** | Refinement tree/graph infra + tests-first (stable) | ✅ **DONE** (`b110284`; 107 tests green; 1199-test floor holds) |
| **P4** | Agent harness + human decision loop | ✅ **DONE** — core `094bfcb` + thin Studio anti-fabrication tools `3fbecec` (record_decision is NOT an agent tool) + `exp-freeze-v1.3` tag `968126d` (refinement added to the guard) |
| P5 | Benchmark + oracle + baselines + preregistration | ✅ **DONE** — 3-task pilot set, oracle, scorer, deterministic A/B/C/D driver + ablations, smoke (all mocks, validates logs + scorer) |
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

## P4 — completed (core `094bfcb` + thin Studio anti-fabrication tools `3fbecec` + `exp-freeze-v1.3` tag)
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
- **Thin Studio layer + anti-fabrication (commit `3fbecec`, touches `packages/studio`):** the requirement
  tools are **thin, pure wrappers** over `RefinementSession` (`requirementTools.ts`, no fs/Electron). The
  §6.1 anti-fabrication rule is wired end to end: **`record_decision` is NOT an agent tool** — the LLM only
  orients (`read_requirement_graph`/`list_obligations`/`select_next_clarification`/`assess_readiness`, all
  reads) and PRESENTS the stakeholder question via `ask_clarification` **tagged with its `obligationId`**.
  The stakeholder's actual answer (option label(s) + typed text from the Studio UI, or the experiment
  oracle's plain text) is the ONLY input that becomes a decision, recorded via
  `recordHumanClarificationAnswer` under actor `user` (product) or the ISOLATED `simulated_user` (experiment)
  — threaded through `resumeWithToolResult`'s new `answerActor` param and merged into the tool message so the
  loop never re-asks. A hallucinated `record_decision` call is **refused** and fabricates nothing; a guess can
  never become a `user_confirmed` source (provenance enforced in the core). Tests: `requirementTools` (21),
  `requirementStore` (6), `requirementClarificationFlow` (2, end-to-end real loop + on-disk session incl. the
  hallucination-refusal case), `clarificationAnswer` (5), `agentHarness` (12) — all green.
- **`exp-freeze-v1.3` tag (commit `968126d`):** the wiring added requirement source under
  `packages/studio/src` (in `TOOL_PATHS`), so the guard moved to a new tag (a real P5/P6 batch would be
  refused on `v1.2`). Coordinated change: `FREEZE_TAG` v1.2→v1.3; **`packages/refinement/src` + package.json
  added to `TOOL_PATHS`** and `refinement` to `DIST_PACKAGES` so the requirement-layer logic studio now
  imports is captured by the guard; `prepare-v13.mjs` (replaces `prepare-v12.mjs`) also builds `@agile-sofl/refinement`;
  the batchRunner `freezeTag` assertion now tracks the `FREEZE_TAG` constant. Verified `freezeStatus → ok` at
  `968126d` (no tool drift, no stale dist). The "experiment freeze v1.2" reasoning-off decision (2026-10-08) is
  the experimental design, not the git tag, and is untouched.
- **Gate scenario #7** (real `.asfl` fixtures pass the language checks) is the studio/parser layer, exercised
  in P5/P6 (the harness's per-step parser/L1/L2 diagnostics are the seam).

## P5 — completed (gate passed: smoke validated logs + scorer, all mocks)
- **3-scenario pilot task set** (prereg §5: pilot = 3 scenarios) — `p5task.ts`, independently authored
  (researcher's gold, NOT from any method's output), each mixing all four stakeholder stances
  (knows / unknown / refuse / defer), bilingual collision-checked keywords so each topic question routes
  to exactly the right item (verified by probe across 3 tasks / 24 items):
  - `booking-01` (booking/cancellation/refund): 8 items.
  - `ecommerce-01` (e-commerce/order/inventory, cross-process consistency): 7 items.
  - `taskmgmt-01` (task management: roles/dependencies/delete-restore): 9 items.
- **Deterministic simulated-stakeholder oracle** (`oracle.ts`, `ef82d3d`) — the gold reader + actor
  stand-in: keyword routing (most hits, tie → reference order), 4 stances, unmatched = no auto-completion,
  seeded deterministic/random modes, full interaction log. Gold isolation: the evaluated agent sees only
  question→response.
- **Isolated `simulated_user` actor + `obligationId` threaded through the harness** (`ca25534`) — the
  `resolveClarification` answer is recorded under the ISOLATED `simulated_user` actor (task book §6.1;
  never the agent, never laundered into `user_confirmed`); the oracle seam for P6's real-LLM `runOnce`.
- **Deterministic run scorer** (`scorer.ts`, `8a999e7`) — pure (no Electron/LLM/IO), independently unit-
  tested against INTENTIONALLY correct/wrong/missing data: decision recall, critical-behavior coverage,
  precision, **unsupported-policy-decisions** (anti-fabrication: a policy value is supported only if backed
  by a real/simulated actor — `user_confirmed`/`analyst_approved`/`simulated_user_answer`; a raw
  `AI_hypothesis`/prose-only/`deferred` is not), traceability integrity, cost DVs, and the pre-registered
  quality floor (recall ≥ 0.80, unsupported = 0, critical ≥ 0.70).
- **Deterministic A/B/C/D method driver + ablations** (`p5methods.ts`, `e894f1b`) — 7 frozen
  `MethodProfile`s (A free-form / B static tree / C adaptive / D proposed + `D−cost-aware` /
  `D−propagation` / `D−obligations`). Reuses the **frozen P3/P4 core** (`RefinementSession` + the
  cost-aware `selectNextClarification` + `StakeholderOracle` + `scoreRun`); mocks out ONLY question wording
  (neutral, from `topicPhrase`, no gold) and question order (the ablation knob). See **ADR-005**: this is a
  self-contained mock driver (prereg §8 "all mocks"), NOT the `runOnce` real-LLM path and NOT a second agent
  system.
- **Smoke (prereg §8 gate): 1 scenario × 1 seed × all main groups, all mocks → validate logs + scorer.**
  `p5methods.test.ts` (11 tests) runs the driver + scorer across the whole 3-task set and validates: oracle
  routing (each item's topic question → that item), ablation wiring, **anti-fabrication** (free-form A's
  prose-only policy values are UNSUPPORTED → floor fails on every task; D meets the floor with 0
  unsupported on every task), honesty of the non-knows items, determinism (byte-identical per seed), and the
  stakeholder-effort budget knob. **The gate test deliberately does NOT assert a D-over-C quality/effort gap**
  (a no-budget canonical oracle gives equal coverage; that gap is the P6 real-LLM measurement — asserting it
  now would be a fabricated result).
- **Tests:** p5methods 11 + scorer 10 + oracle 13 green. Full studio suite unchanged at 390 (385 pass; the
  5 pre-existing failures — Electron binary ×5, `llmPromptsFsf` ×1 — unrelated). tsc baseline unchanged (68).
- **Note for P6:** the mock driver is a P5 validation instrument; P6 retires it from the production path and
  runs A/B/C/D through `core.ts runOnce` (real LLM generates the questions, oracle answers, same `scoreRun`).
  The `exp-freeze-v1.3` tag + `prepare-v13.mjs` remain the P6 `runOnce` vehicle (the mock driver is recorded
  by hash, not the tool-freeze).

## Next actions
1. **P5 ✅ DONE** (oracle `ef82d3d` + threading `ca25534` + scorer `8a999e7` + A/B/C/D driver `e894f1b` +
   3-task pilot set `1e12d2b`; smoke green per ADR-005). No P5 work remains.
2. **P6:** run A/B/C/D + ablations through `core.ts runOnce` on the two authorized FREE APIs (lab
   `lab-qwen3.8-27b`; ECNU `ecnu-max` = `deepseek-v4-flash`), scored by `scoreRun`; pilot 3×2×4≈24 →
   diagnose protocol problems; then the main run per the pilot-variance sample size (no test-set
   overfitting; mark any over-budget sub-result `not run: budget not authorized`, never faked).
3. Paper (P8): cite SAGE-Agent + the others per `literature-notes.md`; RE 2026 = double-blind, 10+2 pages.
