# DECISIONS (ADR index)

## ADR-001 — Build ON the existing stack; add a new typed domain package
**Status:** Accepted (2026-10-30, P0)

**Context.** The toolchain already ships a complete atomic-requirement refinement model
(`editor-api/refinement.ts`: `buildRefinementState`, `applyRefinementStep`, `formatRefinementDigest`,
audit log `.agile-sofl/refinement-log.jsonl`), a mature LLM agent loop (`studio/.../llm/agentLoop.ts`)
with `ask_clarification`/`propose_refinement_step`/`read_refinement_state`, permission gates, an
experiment-condition system (T/B2) + JSONL telemetry, and a trace-link provenance system. Duplicating
any of this would violate non-negotiable rule §0.2.1 (keep existing semantics/features) and §6.1
(do not create a second agent system).

**Decision.** Implement the research increment as a **new package** `packages/refinement`
(`@agile-sofl/refinement`) that:
- is a pure, headless, deterministic TS library (no Electron) so it is unit/property-testable and CI-able;
- depends only on `@agile-sofl/parser` (and, if needed, `@agile-sofl/aspec`) per the module-boundary
  rule (docs/13) — it never imports a sibling product's `src/`;
- is consumed by `@agile-sofl/studio` (agent tools + experiment conditions) and by the headless
  benchmark harness.

**Consequences.** No changes to parser grammar/AST or the existing agent loop. Existing 1092 passing
tests remain the regression floor. The new package adds the research gap only.

## ADR-002 — Reuse the OpenAI-compatible LLM client; free authorized APIs only
**Status:** Accepted (2026-10-30, P0)

**Context.** `chatEcnuStream` (`studio/.../llm/chatEcnu.ts`) is a standard OpenAI-compatible
`/chat/completions` client (Bearer key, streaming, tools, `max_tokens`). The user authorized two
**free** OpenAI-compatible endpoints (lab internal `lab-qwen3.8-27b`, ECNU `ecnu-max`/`.env.ecnu`) and
prohibited consuming paid APIs without explicit budget authorization.

**Decision.** Drive real-model experiments through the same OpenAI-compatible interface pointed at the
authorized free endpoint via `ECNU_API_KEY`/`ECNU_API_BASE_URL`/`ECNU_MODEL`. For the headless harness,
reuse the client shape (a thin OpenAI-compatible fetch wrapper in `packages/refinement` or the harness),
with hard budgets (`--max-calls`, `--max-tokens`, `--max-seconds`, `--dry-run`). Use the
`ruleBased` generator + a **deterministic scripted simulated-stakeholder oracle** for fully-offline mock
replay (API-free). No paid calls.

**Consequences.** Real-model runs are logged to `llm-calls.jsonl` (per-call cost, model, tokens) for the
paper's cost metrics. Mock runs need no network.

## ADR-003 — Research scope (the increment), explicitly bounded
**Status:** Accepted (2026-10-30, P0)

**Decision.** The contribution is the **gap identified in P0**, not a reimplementation of the existing
model:
1. **Requirement-level typed refinement structure**: primary hierarchy (goal → capability → user
   story/feature → process) + **typed cross-links** (`refines`, `depends_on`, `constrains`,
   `conflicts_with`, `satisfies`, `traces_to`, AND/OR/optional). Nodes *reference* existing informal
   node ids and hybrid AST ids (via the trace-link substrate); they do not duplicate them.
2. **Refinement obligations**: first-class typed entities per node, each with a detector (mechanical /
   LLM-assisted-candidate / user-decision), evidence, severity, and discharge condition.
3. **Cost-aware clarification question-selection policy**:
   `priority(q) ≈ expected_quality_gain(q) / (estimated_user_effort(q) + ε)`, with explicit
   decision provenance (`AI_hypothesis` / `user_confirmed` / `simulated_user_answer` / `deferred` /
   `analyst_approved`) and a minimum-risk gate for high-impact policy questions.
4. **Readiness policy**: `READY / NEEDS_CLARIFICATION / DEFERRED / BLOCKED / INCOMPLETE_WITH_RISK`
   with explicit risk acceptance (not just "counters == 0").
5. **Benchmark + deterministic simulated-stakeholder oracle + baselines** (A free-form / B static tree /
   C adaptive / D proposed + ablations), quality-vs-effort metrics, preregistration, analysis scripts.

**Consequences.** Tree depth / child count is **not** a completion metric. LLM guesses are never
auto-marked `user_confirmed`. Hidden reference requirements stay out of evaluated-agent context.
