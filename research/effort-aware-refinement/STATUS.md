# STATUS — Effort-Aware Refinement Research

**Branch:** `research/effort-aware-refinement` · **Baseline commit:** `8f325df`
**Last updated:** 2026-10-30 (P1 in progress)

## Phase gates

| Phase | Gate | Status |
|---|---|---|
| **P0** | Baseline report + arch map + branch + research dir + reproducible build/test | ✅ **DONE** |
| **P1** | Literature + novelty assessment + RQ freeze | 🟡 **IN PROGRESS** (novelty + prereg written; external-lit agent running; RQ freeze conditional) |
| P2 | Conceptual model + semantic design + ADRs | ⬜ |
| P3 | Refinement tree/graph infra + tests-first (stable) | ⬜ |
| P4 | Agent harness + human decision loop | ⬜ |
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

## Next actions
1. **P1 (await):** literature agent returns verified external rows → populate
   `research/literature-matrix.csv`, `literature-notes.md`, and fill novelty-assessment §3; then record
   the **final** GO/REVISE/PIVOT decision.
2. **P2:** finalize `research/conceptual-model.md` (drafted) + semantic design + ADRs.
3. **Do not start P3 before the final P1 GO is recorded** (task book §3.4).
4. **P5/P6 de-risk:** confirm the two authorized free APIs (lab `lab-qwen3.8-27b`, ECNU `ecnu-max`) are
   reachable; plan the `exp-freeze-v1.3` tag for after P4.
