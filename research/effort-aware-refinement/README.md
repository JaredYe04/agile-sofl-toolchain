# Effort-Aware Incremental Refinement of Hybrid Requirements Specifications with LLM Agents

Research workspace for the long-horizon autonomous RE task (master task book:
`Agile_SOFL_Effort_Aware_Research_Master_Task.md` in the sibling `EAIR` repo).

**Target system:** Agile-SOFL Toolchain / Studio (this monorepo).
**Goal venue:** IEEE RE Research Track (Solution-focused paper).
**Baseline commit:** `8f325dfe32db9e2c3498032860fa7bc0cb450227` (branch `research/effort-aware-refinement`).

## One-paragraph summary

We study whether **specification-semantics-informed, cost-aware clarification** can let
stakeholders refine rough requirements into verified hybrid (Agile-SOFL `.asfl`)
specifications at **lower interaction/cognitive cost** without sacrificing requirement
correctness, coverage, or consistency. We build on — not replace — the existing
refinement model (atomic requirements, dual-line ambiguity counters, audit log, docs 25/26)
and the existing LLM agent + clarification + approval + telemetry stack in `packages/studio`.

**The research increment (the gap in the existing tool):**
1. A **typed requirement refinement structure** above the existing process-decomposition
   tree (goal → capability → user story/feature → process), with **typed cross-links**
   (`refines`, `depends_on`, `constrains`, `conflicts_with`, `satisfies`, `traces_to`).
2. **Refinement obligations** (typed, per node) split into mechanically-detectable,
   LLM-assisted-candidate, and user-decision, each with explicit detector + evidence +
   discharge condition.
3. A **cost-aware clarification question-selection policy**
   (`priority(q) ≈ expected_quality_gain(q) / (estimated_user_effort(q) + ε)`) with
   explicit decision provenance (`AI_hypothesis` / `user_confirmed` /
   `simulated_user_answer` / `deferred` / `analyst_approved`).
4. A **benchmark + deterministic simulated-stakeholder oracle + baselines**
   (free-form / static tree / adaptive / proposed), quality-vs-effort metrics, ablations,
   and a preregistered analysis.

## Reproduction

```bash
npm install          # or npm ci
npm run build
npm test             # all workspaces
npm run test:parser  # parser-only
npm run check:boundaries
```

The CI-safe research entrypoint (`npm run research:check`) is added once P3 is stable.
See `benchmarks/README.md` for the experiment runner and `handoff/latest.md` for current state.

## Layout

- `research/` — research questions, literature, novelty, hypotheses, conceptual model, threat model.
- `design/` — architecture, data model, schemas, ADRs, tool contracts, readiness policy, ui-flow.
- `benchmarks/` — datasets, oracle, configs, scripts, outputs, analysis.
- `paper/` — LaTeX draft, references.bib, figures (TikZ), tables, claims audit, reviewer-attack.
- `handoff/` — `latest.md` + `progress.json` (machine-readable resume state).

Top-level status: `STATUS.md`, `WORKLOG.md`, `DECISIONS.md`, `BLOCKERS.md`.

## Integrity rules (from master task book §0.2)

- No fabricated statistics, participants, citations, or performance numbers. Where data is
  missing, write `not evaluated` / `preliminary` / `TBD`.
- Hidden reference requirements and scoring rubrics are for the oracle/evaluator only and must
  never enter an evaluated agent's context.
- LLM guesses must not be auto-marked `user_confirmed`; decisions require a real user, an
  explicitly-configured authorized decision-maker, or an explicitly-labeled simulated user.
- Pushes, releases, email, production deploys, and paid-API spend require explicit user
  authorization. Free authorized APIs (lab internal, ECNU) may be used within documented budgets.
