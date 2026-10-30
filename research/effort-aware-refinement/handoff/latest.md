# HANDOFF — latest

## Current status
- **Branch / commit:** `research/effort-aware-refinement` / latest `f528189`. Baseline `8f325df`.
- **Current phase:** **P1 + P2 DONE → P3 starting.** P1 gate **PASSED (REVISE)**.
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
- **Tests run (command + exit code):** `npm test` → exit 1 (baseline; 5 pre-existing failures in
  `baseline-report.md`). No new failures yet (no product source changed).
- **Changed files/modules (P0–P2):** research workspace docs only. **No product source changed.**
- **Remaining gaps/risks:** P3 core (start now), P4 agent wiring, P5 oracle/baselines/scorer, P6 runs,
  P7 user study (design-only), P8 paper.
- **External blockers:** Electron (B1, environmental, non-blocking); free APIs only (B4, non-blocking);
  user study needs real participants (B5); some literature paywalled (B6).
- **Exact next actions (P3):**
  1. Create `packages/refinement` (mirror an existing package's `package.json` / `tsconfig` / vitest
     setup; headless, deterministic, no Electron; depends on `@agile-sofl/parser`).
  2. Implement **tests-first** per `conceptual-model.md` §13: typed graph (nodes/edges/invariants),
     obligation checker, cost-aware selector (EVPI−Cost), readiness, lifecycle state machine, event
     stream, serialization/migration.
  3. Acceptance (task book §5.3): all §13 tests green; 1092-test floor holds; package builds in the
     workspace. No paid APIs, no fabricated results, no unapproved push.
