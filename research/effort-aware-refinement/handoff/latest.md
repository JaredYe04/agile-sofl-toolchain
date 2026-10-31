# HANDOFF — latest

## Current status
- **Branch / commit:** `research/effort-aware-refinement` / latest `968126d` (= `exp-freeze-v1.3` tag).
  P4 commits: core `094bfcb`, thin Studio anti-fabrication tools `3fbecec`, freeze bump `968126d`. Baseline `8f325df`.
- **Current phase:** **P0+P1+P2+P3+P4 DONE → P5 next.** P1 gate **PASSED (REVISE)**; **P3 gate PASSED**;
  **P4 DONE** — requirement-layer core + the 6 §6.6 gate replay tests (`094bfcb`), the thin Studio
  anti-fabrication tools (`3fbecec`, `record_decision` is NOT an agent tool), and the `exp-freeze-v1.3` tag
  (`968126d`, with `refinement` added to the freeze guard).
- **P4 core decision (the important one for a resumer):** the requirement layer is now a single
  **headless, deterministic `RefinementSession`** in `@agile-sofl/refinement` (task book §6.1 — **NOT a
  second agent system**). It is the one place the typed domain tools + turn orchestration live, so the
  Studio agent / experiment harness consume it as **thin wrappers** (no logic duplication). Because it
  lives in `packages/refinement` (not `packages/studio/src`), it is **Electron-free** (testable here). The
  6 §6.6 gate behaviors are implemented and replay-tested at this layer: coarse→confirm→refine→ready;
  `unknown` never fabricates; `defer` preserves risk + non-blocking branches continue; a changed prior rule
  invalidates/re-evaluates dependents with **no auto re-approval**; a version-stale agent edit is
  **REJECTED, not silently overwritten**; and a decision is **never re-asked** (answered obligations are
  excluded from selection). Anti-fabrication stays structural: a `simulated_user`+`simulated_user_answer`
  answer DOES discharge (the study's interaction proxy) but can **never** launder a node into
  `user_confirmed`/`analyst_approved`.
- **P4 wiring decision (the important one for a resumer — the §6.1 anti-fabrication rule, commit `3fbecec`):**
  **`record_decision` is NOT an agent tool.** The LLM only ORIENTS (`read_requirement_graph` /
  `list_obligations` / `select_next_clarification` / `assess_readiness`, all reads gated on `hybrid.read`)
  and PRESENTS the stakeholder question via `ask_clarification` **tagged with its `obligationId`**. The
  stakeholder's actual answer — option label(s) + typed text from the Studio UI, or the experiment oracle's
  plain text — is the ONLY input that becomes a decision, recorded via `recordHumanClarificationAnswer`
  under actor `user` (product) or the ISOLATED `simulated_user` (experiment) — threaded through
  `resumeWithToolResult`'s new `answerActor` param (the P5 seam) and merged into the tool message
  (`requirementDecision: … ALREADY recorded`) so the loop never re-asks. A hallucinated `record_decision`
  call is **REFUSED** (`not an agent tool`) and fabricates nothing. This is the P5 contract: the oracle
  answers in plain text and the harness passes `answerActor='simulated_user'` — never the agent impersonating
  the user.
- **Freeze tag is now `exp-freeze-v1.3` (commit `968126d`):** the Studio wiring touched `packages/studio/src`
  (in `TOOL_PATHS`), so the guard moved to a new tag or every real P5/P6 batch would be refused. **`refinement`
  was added to `TOOL_PATHS` + `DIST_PACKAGES`** so the requirement-layer logic is captured by the guard.
  `freezeStatus() → ok` at `968126d`. P5/P6 batches must run on `exp-freeze-v1.3` (build it with
  `prepare-v13.mjs`, which now also builds `@agile-sofl/refinement`).
- **P3 gate decision (the important one for a resumer):** `@agile-sofl/refinement` is complete and
  green — 107 tests, `tsc` clean, full `npm test` 1199 passing (1092 baseline + 107; same 5 pre-existing
  studio failures, **zero new**). The anti-fabrication semantics are the subtle part: a
  **correctly-labeled** `simulated_user` + `simulated_user_answer` **does** discharge an obligation
  (it is the experiment's stand-in / interaction proxy, per task book §4.4 — required so the RQs produce
  non-degenerate signal); what is structurally forbidden is a simulated user **laundering a guess into
  `user_confirmed`** (no `simulated_user`→`user_confirmed` path; enforced once in `provenance.ts` and
  checked in `ObligationEngine.discharge`). A raw `AI_hypothesis` never discharges; `deferred` is tracked
  via `defer()`, not `discharge`.
- **P1 gate decision (the important one for a reviewer / resumer):** the literature agent verified that
  **SAGE-Agent (Findings of ACL 2026) already does cost-aware EVPI−Cost question selection**
  (`q* = argmax_q[EVPI(q,ℬ) − Cost(q,t)]`). So the **selection mechanism is prior art** — we **adopt and
  cite** it, not claim it novel. Per the pre-registered REVISE trigger + task book §3.4, the contribution
  is re-scoped to the **joint** (typed requirement structure + typed cross-links, first-class
  detector-classified obligations, explicit decision provenance, explicit readiness policy, cross-node
  *decision* propagation) **over a verified hybrid Agile-SOFL spec**. This does **not** change any frozen
  metric/threshold/comparison; it re-scopes the RQ1 DV target and the RQ3 baseline (preregistration v2).
- **Implemented and verified (P0–P2):** clone + branch + workspace; `npm ci`/`build` (exit 0); `npm test`
  (1092 pass / 5 pre-existing studio failures); 7-package audit (`design/architecture.md`); **full
  experiment-harness audit** (`scripts/agent-harness/`); benchmark-task audit; **verified literature**
  (`literature-matrix.csv`, `literature-notes.md`); **novelty-assessment** (verified, REVISE); **frozen
  preregistration** (v1 + v2); **finalized P2 conceptual model** (`conceptual-model.md` §1–14) + ADR-004.
- **Key facts for P3 (grounded in source):**
  - P4 **added `packages/refinement/src` + `package.json` to the freeze guard's `TOOL_PATHS`** (and
    `refinement` to `DIST_PACKAGES`) so the requirement-layer logic studio now imports is captured; the
    guard tag is now **`exp-freeze-v1.3`**. Real P5/P6 batches must run on that tag (build it with
    `prepare-v13.mjs`, which also builds `@agile-sofl/refinement`).
  - The mechanical obligation detectors should **reuse** the existing parser `DiagnosticCodes`
    (`ASFL_SCOPE_001/002`, `ASFL_TYPE_*`, `ASFL_FSF_*`, `ASFL_CDFD_*`, `ASFL_DATA_*`, `ASFL_REFINE_001`)
    for spec-level checks; the *new* graph invariants (cycles, dangling node refs, duplicate IDs,
    obligation-evidence-absent) operate on the new requirement graph, not the `.asfl`.
  - The cost-aware selector is the **SAGE-Agent EVPI−Cost form** with a **stakeholder-effort** cost term;
    it is a hypothesis under test (RQ3), not a novel mechanism.
  - The two authorized **FREE** APIs are both reachable: lab `lab-qwen3.8-27b` (reasoning model, returns
    `reasoning_content`) and ECNU `ecnu-max` (served by **`deepseek-v4-flash`**).
- **Tests run (command + result, P4 wiring @ `3fbecec` + freeze @ `968126d`):** studio
  `npx tsc --noEmit` → 68 errors = the pre-existing baseline (zero new; fixed one new TS18048 from the
  recording block's optional chain). `npx vitest run` (studio) → **351 pass / 5 fail** — the **5 are the
  same pre-existing** studio failures (4 environmental Electron + 1 `llmPromptsFsf` "implies"), **zero new**.
  Requirement-layer tests green: `requirementTools` (21), `requirementStore` (6),
  `requirementClarificationFlow` (2, end-to-end real loop + on-disk session incl. the `record_decision`
  hallucination-refusal), `clarificationAnswer` (5), `agentHarness` (12, existing flow intact).
  `batchRunner` (8, freeze guard + manifest) green. `freezeStatus()` → **`ok: true`** at `968126d`
  (no tool drift, no stale dist).
- **Changed files/modules (P4 wiring `3fbecec`, 10 files +1227/−6):** `packages/studio/src/.../llm/
  requirementTools.ts` (new, pure executor), `requirementStore.ts` (new, per-project session load/save),
  `agentLoop.ts` (dispatch + obligationId threading + `answerActor` record path), `skills.ts` (drop
  `record_decision` schema, tag `ask_clarification`), `agentTypes.ts` (`ClarificationPrompt.obligationId`),
  `shared/clarificationAnswer.ts` (export `readStructured`), `studio/package.json` (add `@agile-sofl/refinement`),
  + 3 new test files. **Freeze bump `968126d` (5 files +31/−27):** `freeze.ts` (`FREEZE_TAG` v1.3,
  `refinement` added to `TOOL_PATHS`/`DIST_PACKAGES`), `batch.ts` (v1.3 refs + `v13-origin.json`),
  `prepare-v13.mjs` (replaces `prepare-v12.mjs`; also builds `refinement`), `batchRunner.test.ts`
  (assertions track the `FREEZE_TAG` constant), `README.md`.
- **Remaining gaps/risks:** P5 oracle/baselines/scorer, P6 runs, P7 user study (design-only), P8 paper.
  (P4 is complete — no P4 work remains.)
- **External blockers:** Electron (B1, environmental, non-blocking); free APIs only (B4, non-blocking);
  user study needs real participants (B5); some literature paywalled (B6); harness command-safety
  classifier flaps intermittently (B3 — retry succeeds).
- **Exact next actions (P4 ✅ DONE → start P5):**
  1. **P5**: the simulated-stakeholder **oracle** as the harness `resolveClarification` hook
     (`scripts/agent-harness/core.ts`) answering in plain text; thread it through `resumeWithToolResult`
     with **`answerActor = 'simulated_user'`** (the ISOLATED simulator actor, task book §6.1 — never the
     agent) so it drives `RefinementSession.runTurn`. Extend `Condition` to A/B/C/D + ablations
     (SAGE-Agent EVPI−Cost as the RQ3 baseline); scorer + prereg check; smoke + pilot on the offline
     `--dry-run` fake-LLM path first, **running on `exp-freeze-v1.3`** (build via `prepare-v13.mjs`),
     then the authorized FREE APIs.
  2. No paid APIs, no fabricated results, no unapproved push.
