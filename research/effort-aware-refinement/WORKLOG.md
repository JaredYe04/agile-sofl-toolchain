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
