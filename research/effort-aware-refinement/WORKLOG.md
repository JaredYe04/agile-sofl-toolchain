# WORKLOG — time-ordered

## 2026-10-30 — P0 (repo audit, baseline, workspace init)

- **Setup:** `git clone https://github.com/JaredYe04/agile-sofl-toolchain` → HEAD `8f325df`.
  `git checkout -b research/effort-aware-refinement`.
- **Env:** Windows 11 Pro, Node v26.13.0, npm 11.20.0, git 2.56.0. `D:\repos` is the clone root;
  `D:\repos\EAIR` holds the master task book + `skills/`.
- **Install:** `npm ci` → exit 0.
- **Build:** `npm run build` → exit 0 (all 7 workspaces; studio electron-vite + stage:parse-bridge).
- **Test:** `npm test` → parser 493, gui 23, aspec 46, editor-api 196, language-server 50, vscode 84
  (all pass); studio 322 pass / **5 fail** (3 files):
  - `projectTemplate.test.ts`, `experimentTelemetry.test.ts` (4 tests) → `Electron failed to install
    correctly` (environmental; electron binary absent in sandbox).
  - `llmPromptsFsf.test.ts` → `expected '...implies...' not to match /\bimplies\b/i` (pre-existing:
    the `hybrid-generation` skill prompt in `skills.ts` contains "implies").
  - **1092 passing / 5 failing = fixed baseline.**
- **Audit (read-only):** read docs 25 (atomic req + refinement measurement), 26 (trace), 17 (informal/
  hybrid editor), 13 (module boundaries), README; read sources:
  - parser: `refine/atomicity.ts`, `index.ts` (public API), fsf/cdfd/refine structure, test tree.
  - aspec: `index.ts`, `trace/coverage.ts`, `generators/llm.ts`, `model.ts`, `refine/*`.
  - editor-api: `refinement.ts` (full state machine), file list.
  - studio: `llm/agentLoop.ts`, `llm/skills.ts`, `llm/agentTypes.ts`, `llm/experiment.ts`,
    `llm/chatEcnu.ts`, `projectService.ts`, main/renderer file trees.
  - `.github/workflows/ci.yml`, `examples/*` (library-system.asfl, library-informal.aspec),
    `docs/13`, `pnpm-workspace.yaml`, root `package.json`.
- **Key conclusions:**
  1. Existing toolchain is far more complete than its README: full agent loop + clarification + approval
     + permission + experiment-condition + telemetry + atomic-requirement refinement + trace provenance.
  2. Research gap = requirement-level typed structure + cost-aware question selection + first-class
     obligations + readiness policy + benchmark/oracle/baselines.
  3. `chatEcnuStream` is OpenAI-compatible → the user-authorized free lab API (`lab-qwen3.8-27b`) and
     ECNU (`ecnu-max`) can drive the agent; no paid API needed. `ruleBased.ts` generator = API-free
     offline fallback for mock replay.
  4. Module-boundary rule: new work should be a **new package** (`packages/refinement`) depending on
     parser (+ optionally aspec/editor-api), and studio consumes it — never import sibling `src/`.
- **Artifacts written:** `README.md`, `baseline-report.md`, `design/architecture.md`, `STATUS.md`,
  `WORKLOG.md`, `DECISIONS.md`, `BLOCKERS.md`, `handoff/latest.md`, `handoff/progress.json`.
- **Commit:** (P0 commit hash recorded in progress.json / handoff).

## 2026-10-30 — P1 (literature + novelty + RQ freeze; in progress)

- **Dispatched literature-verification agent** (agentId `aa5fa1c96a090d235`, general-purpose): verifying
  OntoAgent (arXiv:2605.05828), Tower (IEEE TSC DOI 10.1109/TSC.2025.3624915), SAGE-Agent (ACL Findings
  2026), Goal2Story (arXiv:2503.13279), KAOS (Dardenne/van Lamsweerde/Fickas 1993), SOFL (Liu, JSS 2021,
  DOI 10.1016/j.jss.2021.110975), NASA-TLX, RE 2026 CFP. **Still running** (output buffered until
  completion). Its verified output will populate `literature-matrix.csv` / `literature-notes.md` /
  novelty §3.
- **Confirmed B1 environmental:** `node_modules/electron/dist` has only `locales/`, no binary;
  `install.js` exits 0 but binary absent. `tests/agentHarness.test.ts` **mocks electron and PASSES** →
  headless harness usable for P5/P6 (mock LLM or the authorized free LLM). Recorded in BLOCKERS.md
  (commit `7e30f73`).
- **Audit (read-only) of experiment harness** `packages/studio/scripts/agent-harness/`:
  - `Condition = 'T' | 'B2' | 'B0-auto'` (batch.ts) — A/B/C/D + ablations must extend this (P5).
  - `installDryRunFetch` → **fully offline** fake-LLM path (`--dry-run`, no network/key) for harness
    validation before any model spend.
  - **Freeze guard** (freeze.ts): `FREEZE_TAG = 'exp-freeze-v1.2'`; `TOOL_PATHS` includes
    `packages/studio/src` (so P4's new tools under studio/src will break the guard until a new freeze
    tag, e.g. `exp-freeze-v1.3`), but **not** `packages/refinement` (new package is safe).
  - `B0-auto` = `refineAspecWithCheck` (deterministic no-LLM baseline).
  - Block-randomized seeded schedule (mulberry32, Fisher-Yates per block), 429/503 exponential backoff,
    `--resume`, `--stop-at`, blinded `out/blinded/<id>`, per-step parser/L1/L2 diagnostics,
    `resolveClarification` oracle hook, `promptHash` fairness, `UNMATCHED_CLARIFICATION_REPLY`
    anti-fabrication sentinel.
  - `electron-stub.ts` = minimal electron stand-in (app/ipcMain/BrowserWindow noops).
- **Audited benchmark seed tasks** `packages/parser/tests/fixtures/reference-systems/`:
  - `classroom.aspec`: 6 functions, 7 data resources, 8 constraints (uniqueness, permission,
    time-boundary, FK references).
  - `delivery-trimmed.aspec`: order status state machine, cross-process constraints (未支付不能接单,
    一单一骑手, 支付幂等, 送达后才能完成), role boundaries (客户/商家/骑手), timeout auto-complete.
    Both exercise gaps G1–G7; delivery maps directly to the e2e scenarios in conceptual-model §10.
- **Read the @skills writing skills** (P8 prep): `project-writing-overlay.md` (overlay wins on conflict;
  no DASR/environment/fault-prevention reframing; no fabricated quotes/claims), `humanizer/SKILL.md`
  (primary English de-AI pass: §1–§26 AI-tell patterns), `de-ai-writing/SKILL.md` (Chinese material).
  Note: `notes/liu-academic-writing-style.md` and `AGENTS.md` referenced by the overlay are **not** in
  this workspace (they live in the original repo).
- **Wrote `research/novelty-assessment.md`** (commit `7e30f73`): internal prior-work boundary I1–I8 and
  gap G1–G7 verified from source; external-literature rows explicitly marked PENDING (never invented);
  interim recommendation **GO** with REVISE/PIVOT triggers.
- **Wrote `research/hypotheses-and-preregistration.md`** (commit `28269cd`): frozen RQs + H0s, DV
  operational definitions, quality floor (recall ≥ 0.80, unsupported-policy = 0, critical-behavior
  coverage ≥ 0.70), task/oracle schema, anti-fabrication invariants, statistical plan, exclusion rules,
  smoke/pilot/main run plan on the two authorized FREE APIs only.
- **P1 gate state:** RQ freeze structure is done; final GO/REVISE/PIVOT is **conditional on** the
  literature agent's verified external rows. Do not start P3 before the final GO is recorded.

## 2026-10-30 — P3 (refinement infrastructure, tests-first) — DONE, committed `b110284`
Built `@agile-sofl/refinement` (headless, deterministic; 14 src + 10 test) tests-first per conceptual-model §11/§13: typed RequirementGraph, detector-classified obligations with `discharge()` as the anti-fabrication choke point, provenance, DecisionStore + propagation, cost-aware selector, ReadinessAssessor, replayable EventLog, schemaVersion=1 serialization. 107/107 pass, tsc clean, full npm test 1199 (1092 baseline + 107; same 5 pre-existing studio failures, zero new) → floor holds. P3 gate PASSED → P4 next (integration points in handoff/latest.md).

## 2026-10-31 — P4 (requirement-layer domain tools + §6.6 gate replay tests) — CORE DONE, committed `094bfcb`
Built `RefinementSession` (`packages/refinement/src/session.ts`) — the single **headless, deterministic,
typed domain-tool + turn-orchestration** layer (task book §6.1: NOT a second agent system; the Studio agent
/ harness consume it as thin wrappers). Placed in `packages/refinement` → freeze-guard-safe + Electron-free.
Tools: readRefinementTree, proposeRefinement (AI_hypothesis candidates, never user_confirmed),
checkObligations, listOpenObligations, selectNextClarification (cost-aware; answered obligations never
re-asked), recordDecision (isolated actor; confirm/answer discharges + honest source, defer tracks,
unknown/reject fabricates nothing; `supersedes` re-evaluates the full impact set + pulls dependents to
needs_clarification — no auto re-approval), proposeRevision/applyRevision (version-gated; stale proposals
REJECTED not overwritten), assessReadiness, runTurn (deterministic loop; budget exhaustion = stop).
Added the **six §6.6 gate replay tests** (`tests/session-gate.test.ts`), each run twice with deterministic id
generators to prove replay determinism: (1) coarse→confirm→refine→READY; (2) `unknown` does not fabricate;
(3) `defer` preserves risk + non-blocking branch continues; (4) prior-rule change invalidates dependents,
no auto re-approval; (5) version-stale edit REJECTED; (6) no infinite re-ask. + 2 anti-fabrication tests
(simulated_user answer discharges as proxy, never launders into user_confirmed).
**Tests:** refinement 115 green (107+8); tsc + build clean; full `npm test` **1329 passing / 5 failing**
(verified per-workspace: parser 493, refinement 115, gui 23, aspec 46, editor-api 196, language-server 50,
vscode 84, studio 322) — same 5 pre-existing studio failures, **zero new**. (Corrected the earlier
"1199" total, which was a miscount of this same breakdown.) Remaining P4 = thin Studio agent tools +
`exp-freeze-v1.3` tag (touches `packages/studio`).

## 2026-10-31 — P4 (thin Studio anti-fabrication tools + `exp-freeze-v1.3`) — DONE, committed `3fbecec` + tag `968126d`
Built the thin Studio requirement layer and wired the §6.1 anti-fabrication rule end to end, then cut the
new freeze tag. **Design correction from the task book §6.1 ("record_decision 不能由 Agent 假扮用户直接调用；
实验中必须明确使用经过隔离的 simulator actor"):** `record_decision` is **NOT an agent tool** — the LLM only
ORIENTS (`read_requirement_graph`/`list_obligations`/`select_next_clarification`/`assess_readiness`, all reads,
gated on `hybrid.read`) and PRESENTS the stakeholder question via `ask_clarification` **tagged with its
`obligationId`**. The stakeholder's actual answer (option label(s) + typed text from the Studio UI, or the
experiment oracle's plain text) is the ONLY input that becomes a decision, recorded via
`recordHumanClarificationAnswer` under actor `user` (product) or the ISOLATED `simulated_user` (experiment) —
threaded through `resumeWithToolResult`'s new 9th `answerActor` param and merged into the tool message
(`requirementDecision`, "ALREADY recorded") so the loop never re-asks. A hallucinated `record_decision` call
is REFUSED (`not an agent tool`) and fabricates nothing; a guess can never become a `user_confirmed` source
(provenance enforced once in the core `provenance.ts`).

- **Files (commit `3fbecec`, 10 files, +1227/-6):** `requirementTools.ts` (new, pure executor: 4 read/assess
  tools + `clarificationAnswerToDecision` pure mapping + `recordHumanClarificationAnswer` single decision
  entry point; `REQUIREMENT_TOOL_NAMES` has 4, `record_decision` deliberately absent), `requirementStore.ts`
  (new, per-project load/save/clear of the `RefinementSession` at `.agile-sofl/requirement-graph.json`),
  `agentLoop.ts` (dispatch requirement tools; `ask_clarification` carries `obligationId`; `resumeWithToolResult`
  records the human answer into the session + persists + merges the effect), `skills.ts` (remove `record_decision`
  schema; tag `ask_clarification` with `obligationId`), `agentTypes.ts` (`ClarificationPrompt.obligationId`),
  `clarificationAnswer.ts` (export `readStructured`), `studio/package.json` (add `@agile-sofl/refinement` dep).
- **Tests (all green):** `requirementTools` (21, incl. the `record_decision` refusal + simulated-user never-
  launder + answer-mapping edge cases), `requirementStore` (6), `requirementClarificationFlow` (2, **end-to-end
  real agent loop + on-disk session**: (1) LLM orients + presents tagged question → human clicks confirm →
  obligation satisfied, node `ready`/`user_confirmed`, actor `user`, `human_clarification_answer`; (2) model
  hallucinates `record_decision` → REFUSED, obligation stays open, node stays `AI_hypothesis`/`draft`),
  `clarificationAnswer` (5), `agentHarness` (12, existing flow intact). **Full studio `vitest run` → 351 pass /
  5 fail (the same 5 pre-existing: 4× Electron-environmental + 1× `llmPromptsFsf` "implies"); ZERO new.**
  `tsc --noEmit` back to the 68 baseline (fixed one new `TS18048` from the recording block's optional chain).
- **Freeze bump to `exp-freeze-v1.3` (commit `968126d`, tag `968126d`, 5 files +31/-27):** the wiring added
  requirement source under `packages/studio/src` (in `TOOL_PATHS`), so the guard must move to a new tag or
  every real P5/P6 batch would be refused (`v1.2` predates the requirement tools + the studio refinement dep).
  Coordinated change: `freeze.ts` `FREEZE_TAG` v1.2→v1.3 + **add `packages/refinement/src` + `package.json` to
  `TOOL_PATHS`** and `refinement` to `DIST_PACKAGES` (so the requirement-layer logic studio now imports is
  captured by the guard — a drift in `refinement/src` can no longer silently change experiment behaviour);
  `batch.ts` header/messages/`v13-origin.json` origin name/`prepare-v13.mjs` refs; `prepare-v13.mjs` (replaces
  `prepare-v12.mjs` per convention; also builds `@agile-sofl/refinement`); `batchRunner.test.ts` imports
  `FREEZE_TAG` so the manifest `freezeTag` assertion tracks the constant + test name updated. The "experiment
  freeze v1.2" **reasoning-off decision** (2026-10-08, in `agentLoop.ts`/`experimentTelemetry.test.ts`) is the
  experimental design, NOT the git tag — left untouched. Verified `freezeStatus() → { ok: true }` at `968126d`
  (no tool drift, no stale dist) + `batchRunner` 8/8 + full studio 351/5.
- **Note:** the harness command-safety classifier (lab-qwen3.8-27b) flapped hard this window ("temporarily
  unavailable" / transient denials on Bash/Write/Edit); every call succeeded on retry (B3). One commit message
  was first mangled by a PowerShell `@'...'@` here-string under bash — amended with a bash `<<'EOF'` heredoc.
- **P4 is DONE.** Next = **P5** (oracle + baselines + scorer; runs on `exp-freeze-v1.3`).

## 2026-11-01 — P5 (benchmark + oracle + scorer + baselines + smoke) — DONE, commits `ef82d3d`→`1e12d2b`
Built the frozen P5 benchmark/oracle/scorer/baselines and validated the smoke (prereg §8) with ALL MOCKS
(no LLM, no API spend). Five commits: `ef82d3d` (frozen task schema + deterministic simulated-stakeholder
oracle), `ca25534` (thread the ISOLATED `simulated_user` actor + `obligationId` through the harness — the
P6 oracle seam), `8a999e7` (deterministic run scorer), `e894f1b` (deterministic A/B/C/D method driver +
gate test), `1e12d2b` (complete the 3-task pilot set).

- **3-task pilot set** (`p5task.ts`): independently authored researcher gold (NOT from any method's output),
  each scenario mixing all four stances (knows/unknown/refuse/defer) with bilingual collision-checked
  keywords so each topic question routes to exactly the right item: `booking-01` (8 items),
  `ecommerce-01` (e-commerce/order/inventory, 7 items), `taskmgmt-01` (task management: roles/dependencies/
  delete-restore, 9 items). Every item carries a neutral `topicPhrase` (a question, never the gold value)
  that the mock driver words its questions from — no gold is exposed.
- **Oracle** (`oracle.ts`): the gold reader + actor stand-in. Keyword routing (most hits, tie → reference
  order), 4 stances, unmatched question → unanswerable (NO auto-completion of defaults), seeded
  deterministic + random modes, full interaction log (question, matched items, stance, basis). Gold
  isolation: the evaluated agent sees only question→response.
- **Scorer** (`scorer.ts`): pure (imports only `p5task`), independently unit-tested against INTENTIONALLY
  correct/wrong/missing data (prereg §7.5). Reports the frozen DVs: decision recall, critical-behavior
  coverage, precision, **unsupported-policy-decisions** (anti-fabrication — a policy value is "supported"
  only if backed by a real/simulated actor; `AI_hypothesis`/prose-only/`deferred` do not count),
  traceability integrity, cost DVs, and the pre-registered quality floor (recall ≥ 0.80, unsupported = 0,
  critical ≥ 0.70).
- **A/B/C/D method driver + ablations** (`p5methods.ts`): 7 frozen `MethodProfile`s (A free-form /
  B static tree / C adaptive / D proposed + `D−cost-aware` / `D−propagation` / `D−obligations`). Reuses the
  FROZEN P3/P4 core (`RefinementSession` + cost-aware `selectNextClarification` + `StakeholderOracle` +
  `scoreRun`); mocks out ONLY question WORDING (neutral, from `topicPhrase`) and question ORDER (the
  ablation knob). **ADR-005** records that this is a self-contained deterministic mock (prereg §8 "all
  mocks"), NOT the `runOnce` real-LLM path and NOT a second agent system (task book §6.1).
- **Smoke gate (prereg §8):** `p5methods.test.ts` (11 tests) runs the driver + scorer across the whole
  3-task set and validates logs + scorer: oracle routing (each item's topic question → that item, first
  match, not unmatched), ablation wiring (each profile reports its frozen flags; A records 0 decisions,
  typed methods record one per item), **anti-fabrication** (free-form A's prose-only policy values are
  UNSUPPORTED → floor fails on every task; D meets the floor with 0 unsupported on every task; B/C/D +
  ablations all supported + floor), honesty of the non-knows items (left open, never fabricated; the
  recorded answer is an honest terminal), determinism (byte-identical artifacts + trace per seed), and the
  stakeholder-effort budget knob (a question budget binds and stops the cost-aware run early).
  **Honesty boundary:** the gate test does NOT assert a D-over-C quality/effort gap — with no budget and a
  canonical oracle every typed method recovers the full set (equal coverage); the selection/obligations/
  propagation knobs change ORDER + provenance-source, not coverage, in the mock. The gap is a P6 real-LLM
  measurement; asserting it here would be a fabricated result.
- **Routing verification (probe, temporary, deleted):** all 24 items across the 3 tasks self-route
  (`matchedItemIds[0] === item.id`, `unmatched = false`), and D meets the floor / A fails it on every task.
- **Tests:** p5methods 11 + scorer 10 + oracle 13 = 34 green. Full studio `vitest run` → **385 pass / 5
  fail** (the same 5 pre-existing: `projectTemplate` + `experimentTelemetry`×4 = Electron binary missing
  (environmental); `llmPromptsFsf` = pre-existing "implies" prompt assertion — all unrelated to P5).
  `tsc --noEmit` → **68** = pre-existing baseline (zero new).
- **P5 is DONE.** Next = **P6** (run A/B/C/D + ablations through `core.ts runOnce` on the two authorized
  FREE APIs, scored by `scoreRun`; pilot 3×2×4≈24 → diagnose; then the main run per pilot-variance sample
  size). The mock driver is a P5 validation instrument — P6 retires it from the production path.
