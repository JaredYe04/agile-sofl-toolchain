# HANDOFF — latest

## Current status
- **Branch / commit:** `research/effort-aware-refinement` / latest `b110284` (P3 green). Baseline `8f325df`.
- **Current phase:** **P0+P1+P2+P3 DONE → P4 starting.** P1 gate **PASSED (REVISE)**; **P3 gate PASSED**.
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
  - New package `packages/refinement` is **not** in the freeze guard's `TOOL_PATHS` → building it won't
    trip `exp-freeze-v1.2`. **P4's** new Studio agent tools **are** under `packages/studio/src` → a new
    freeze tag (`exp-freeze-v1.3`) is needed before real batches.
  - The mechanical obligation detectors should **reuse** the existing parser `DiagnosticCodes`
    (`ASFL_SCOPE_001/002`, `ASFL_TYPE_*`, `ASFL_FSF_*`, `ASFL_CDFD_*`, `ASFL_DATA_*`, `ASFL_REFINE_001`)
    for spec-level checks; the *new* graph invariants (cycles, dangling node refs, duplicate IDs,
    obligation-evidence-absent) operate on the new requirement graph, not the `.asfl`.
  - The cost-aware selector is the **SAGE-Agent EVPI−Cost form** with a **stakeholder-effort** cost term;
    it is a hypothesis under test (RQ3), not a novel mechanism.
  - The two authorized **FREE** APIs are both reachable: lab `lab-qwen3.8-27b` (reasoning model, returns
    `reasoning_content`) and ECNU `ecnu-max` (served by **`deepseek-v4-flash`**).
- **Tests run (command + exit code):** `npm run test --workspace @agile-sofl/refinement` → 107/107 pass
  (10 files). Full `npm test` → 1199 passing (1092 baseline + 107 refinement); same **5 pre-existing**
  studio failures (4 environmental Electron + 1 `llmPromptsFsf` "implies" assertion), **zero new**.
  `npm run build --workspace @agile-sofl/refinement` → `tsc` clean (exit 0).
- **Changed files/modules (P3):** new `packages/refinement/` (14 src + 10 test + README/package.json/
  tsconfig/vitest.config, 3722 insertions, commit `b110284`); root `package.json` build/test chains +
  `package-lock.json` (refinement workspace entry). **Product packages untouched** (no parser/studio
  source change).
- **Remaining gaps/risks:** P4 agent wiring (next), P5 oracle/baselines/scorer, P6 runs, P7 user study
  (design-only), P8 paper.
- **External blockers:** Electron (B1, environmental, non-blocking); free APIs only (B4, non-blocking);
  user study needs real participants (B5); some literature paywalled (B6).
- **Exact next actions (P4 — P3 is DONE at `b110284`):**
  1. Add `@agile-sofl/refinement` to studio deps; build the 5 **thin** agent tools
     (`read_requirement_graph`, `list_obligations`, `select_next_clarification`, `record_decision`,
     `assess_readiness`) as `HybridAgentBootstrapPayload` specs (pattern:
     `packages/studio/src/renderer/lib/refineAgentTools.ts`; registration:
     `main/services/llm/agentLoop.ts`), each a thin call into the refinement package — no logic
     duplication.
  2. Thread decision provenance (actor + provenance on every decision; never an `AI_hypothesis`
     confirmation). Add **replay tests** (task book §6.6): same op sequence + deterministic id gen ⇒
     identical ids / verdicts.
  3. Acceptance: `tsc` clean + full `npm test` green (1199 floor). Then cut the `exp-freeze-v1.3` tag
     (the current `exp-freeze-v1.2` guard covers `packages/studio/src`, which P4 touches).
  4. No paid APIs, no fabricated results, no unapproved push.
