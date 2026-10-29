# HANDOFF — latest

## Current status
- **Branch / commit:** `research/effort-aware-refinement` / latest `28269cd`. Baseline `8f325df`.
  P0 commit `2ef7d8c`; P1 commits `7e30f73` (novelty + BLOCKERS) and `28269cd` (preregistration).
- **Current phase:** **P1 in progress.** P0 complete. Literature-verification agent
  (`aa5fa1c96a090d235`) **still running** (verifying external competing work). Internal prior-work
  boundary and the RQ/metric/threshold/comparison pre-registration are **done and committed**.
- **Implemented and verified (P0 + P1 so far):** clone + branch + research workspace; `npm ci` (exit 0);
  `npm run build` (exit 0); `npm test` (1092 pass / 5 pre-existing studio failures: 4× environmental
  Electron-binary-missing, 1× pre-existing prompt-content assertion); full read-only audit of all 7
  packages → `design/architecture.md`; **full audit of the headless experiment harness**
  (`scripts/agent-harness/`); audit of the two reference benchmark tasks; **novelty-assessment.md**
  (internal gap G1–G7 verified from source; external rows PENDING, none invented); **hypotheses-and-
  preregistration.md** (frozen RQs, DVs, quality floor, task/oracle schema, anti-fabrication invariants,
  stats plan, run plan).
- **Key findings (P1):**
  1. The headless harness is **usable in this sandbox**: `tests/agentHarness.test.ts` mocks electron and
     passes; an **offline `--dry-run` fake-LLM path** lets me validate the harness end-to-end with no
     network/key before any model spend.
  2. **Freeze guard gotcha for P5/P6:** `freeze.ts` `TOOL_PATHS` includes `packages/studio/src`. When P4
     adds the planner as new agent tools under `studio/src`, a **new freeze tag (e.g. `exp-freeze-v1.3`)**
     is required before real batches run. `packages/refinement` (new) is NOT in `TOOL_PATHS`.
  3. Experiment conditions today are `T | B2 | B0-auto`; my **A/B/C/D + ablations** extend this enum in P5.
     `B0-auto` = `refineAspecWithCheck` (deterministic no-LLM) is a reusable baseline.
  4. The **prior trace-recovery paper** by the same group (referenced in `docs/26`) and the existing
     atomic-requirement / dual-line / grain refinement model (`docs/25`) are the main things to cite and
     differentiate; our increment is the requirement-level structure + cost-aware planner + propagation +
     readiness, not the language or the goal formalism.
- **Tests run (command + exit code):** `npm test` → exit 1 (baseline; 5 pre-existing failures in
  `baseline-report.md`). No new failures (no product source changed yet).
- **Changed files/modules (P0–P1):** research workspace docs only. **No product source changed.**
- **Experimental evidence available:** none run yet (P0/P1 = audit + design). Baseline results recorded.
- **Remaining gaps/risks:** external-literature verification (agent running); research core (P2–P3);
  oracle/baselines/scorer (P5); real-model runs (P6); user study (P7, design-only); paper (P8).
- **External blockers:** Electron binary (B1, environmental, non-blocking); real-model budget = FREE APIs
  (B4, non-blocking); user study needs real participants (B5, by design); literature may be paywalled (B6).
- **Exact next actions:**
  1. (running) Literature agent → when it returns, fill `literature-matrix.csv`, `literature-notes.md`,
     novelty-assessment §3; then record the **final** GO/REVISE/PIVOT decision (the P1 gate).
  2. Finalize `research/conceptual-model.md` (drafted) + semantic design + ADRs (P2).
  3. De-risk P5/P6: confirm the two authorized FREE APIs (lab `lab-qwen3.8-27b`, ECNU `ecnu-max`) are
     reachable; plan the `exp-freeze-v1.3` tag for after P4.
  4. **Do NOT start P3 before the final P1 GO is recorded** (task book §3.4).
