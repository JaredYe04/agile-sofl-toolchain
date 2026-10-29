# STATUS — Effort-Aware Refinement Research

**Branch:** `research/effort-aware-refinement` · **Baseline commit:** `8f325df`
**Last updated:** 2026-10-30 (P0 complete)

## Phase gates

| Phase | Gate | Status |
|---|---|---|
| **P0** | Baseline report + arch map + branch + research dir + reproducible build/test | ✅ **DONE** (this session) |
| P1 | Literature + novelty assessment + RQ freeze | ⬜ next |
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

## Blockers (see BLOCKERS.md)
- Electron binary not installed in sandbox (4 studio test files fail environmentally). Non-blocking for
  the research core (parser/aspec/editor-api + headless agent harness).
- (transient) harness command-safety classifier flapping during P0 — retries succeeded.

## Next actions (P1)
1. Verify the direct-competition literature (OntoAgent arXiv:2605.05828; Tower TSC
   10.1109/TSC.2025.3624915; SAGE-Agent ACL Findings 2026; Goal2Story arXiv:2503.13279; KAOS; SOFL Liu
   JSS 2021 10.1016/j.jss.2021.110975) via WebSearch/WebFetch; record verified citations.
2. Build `research/research-questions.md` (2–3 primary RQs), `literature-matrix.csv`,
   `literature-notes.md`, `novelty-assessment.md` (go/revise/pivot).
3. Freeze RQs before large implementation (task book §3.4).
