# Research Questions — Effort-Aware Incremental Refinement (DRAFT, pending P1 literature freeze)

**Status:** DRAFT. To be finalized (and possibly narrowed/revised) after `novelty-assessment.md`.
Per task book §3.3, the paper will carry **2–3 primary RQs**; others are supplementary.

## Problem restatement (P0-grounded)

Refining rough requirements (user stories / goals) into a *verified* hybrid Agile-SOFL specification
(`.asfl`) currently requires a stakeholder to answer many clarification questions and confirm many
policy decisions, with the LLM agent choosing *which* question to ask and *when* to stop largely
ad hoc. The existing toolchain already provides: a typed specification model (parser + FSF + CDFD +
data-refine), an atomic-requirement refinement model with auditable steps (`editor-api/refinement.ts`),
and an LLM agent with clarification/approval/telemetry and a headless experiment harness. **The gap** is a
*cost-aware, semantics-informed clarification planner* operating over a *typed requirement-level structure*
with *cross-node decision propagation* and an explicit *readiness policy* — and an evaluation of whether it
reduces stakeholder effort without sacrificing specification quality.

We do **not** claim "deeper tree = better", "more formal = better", or "fewer questions = better". The goal
is *sufficiently correct, verifiable, traceable requirements for the current activity, at lower stakeholder
cost*. The user may always choose `unknown`, `defer`, `none of the above`, free text, or withdraw a decision.

## Design of the compared methods (task book §7.2)

- **A — Free-form dialogue**: same base LLM, ordinary conversational elicitation; may ask and then emit the
  required target format.
- **B — Static tree**: tree-structured decomposition, questions asked in a fixed/static order, **no**
  semantic-obligation ranking.
- **C — Adaptive clarification**: generic relevance/uncertainty/cost ranking of questions, **no**
  Agile-SOFL semantic obligations.
- **D — Proposed**: requirement-level typed tree + typed cross-links + **semantic obligations** +
  **cost-aware selection** + **dependency propagation** + approval/provenance + readiness policy.

Primary contrasts: **D vs C** (incremental contribution of formal semantics); **D vs B** (contribution of
the adaptive mechanism); **D vs A** (overall practical benefit). Ablations: `D − cost-aware`,
`D − propagation`, `D − obligations`.

## Primary RQs

### RQ1 — Specification quality (primary)
> At a comparable stakeholder-effort budget, does spec-semantics-guided, cost-aware refinement (D) produce
> requirements that are **more correct, more complete (recall of reference decisions), more consistent
> (fewer contradictions / cross-node inconsistencies), and contain fewer unconfirmed policy assumptions**
> than A / B / C?

- **H0 (quality):** D does not differ from C on requirement recall, precision, critical-behavior coverage,
  contradiction count, or unsupported-policy count.
- **Dependent variables (operational):**
  - requirement/decision **recall** = (reference must-haves correctly recovered) / (reference must-haves);
  - **precision** = (supported/confirmed claims) / (all decidable claims proposed);
  - **critical-behavior coverage** = coverage of reference state/boundary/exception behaviors;
  - **contradiction count** (rule-based + manual);
  - **unsupported policy decisions** = high-impact policy entries in the final spec with no `user_confirmed`
    / `analyst_approved` provenance;
  - **traceability integrity** = fraction of typed links that resolve to valid entities + are decision-backed.
- **Independent variable:** method (A/B/C/D), crossed with task (fixed set) and seed.

### RQ2 — Stakeholder effort (primary)
> At a **fixed quality threshold** (e.g., a pre-registered floor on recall + zero unsupported-policy
> decisions), does D **reduce stakeholder interaction cost** relative to baselines?

- **H0 (effort):** at the quality threshold, D's interaction cost is not lower than C's (or B's/A's).
- **Cost metrics (automated experiments — proxies, NOT real cognitive load):** number of clarification
  questions; number of user actions / option-clicks / free-text answers; cumulative words/tokens the
  stakeholder must read and type; **redundant questions** (re-asking a decided item); wall-clock (labeled as
  machine time, not human time); total model input/output tokens, tool calls, and resource cost (currency +
  pricing date recorded).
- **Reporting rule (task book §7.4):** report the **quality-vs-effort Pareto** and cost *at* the quality
  threshold; low question count at below-threshold quality is **not** a win.

### RQ3 — Mechanism contribution (ablation; primary or supplementary)
> How much of D's benefit comes from (i) **typed semantic obligations**, (ii) **cost-aware question
> selection**, and (iii) **cross-node decision propagation**?

- **H0 (ablation):** each component contributes not-significantly to RQ1/RQ2 outcomes.
- **Design:** `D`, `D − obligations`, `D − cost-aware`, `D − propagation` (+ their pairwise combinations if
  budget allows), under the *same* task set, oracle, and information access. Component presence/absence is
  the independent variable; RQ1/RQ2 DVs are the outcomes.

## Supplementary RQ

### RQ4 — Scale and maintenance (optional, conditional on budget)
> As the requirement structure grows and requirements change, does the mechanism avoid **re-clarification**
> and maintain **consistency** (i.e., a change to a confirmed decision invalidates/reevaluates dependent
> nodes without silently re-approving them)?

- Measured via: redundant questions on re-runs after a change; number of dependent nodes correctly
  re-evaluated; contradictions introduced by a change; time/cost to re-establish readiness after a change.

## Variables, operationalization, confounds

- **Unit of analysis:** task × seed × method run. Paired (task/seed) comparisons; bootstrap 95% CIs +
  effect sizes; mixed-effects model (task/seed random) if structure allows (task book §7.6).
- **Confounds to control (pre-registered):** base model + temperature identical across methods; identical
  task + oracle + information access; identical question/tool budgets (where comparable); the D-only hidden
  reference requirements and rubric never enter any evaluated method's context (oracle isolation);
  post-clarify read budget applied uniformly; prompt/version/seed recorded per run.
- **Multiple comparisons:** family of RQ1/RQ2 metrics; pre-declared primary metric per RQ, the rest
  secondary; report multiplicity risk.
- **Failure handling:** failed runs retained in logs; pre-defined technical-failure rules; no silent drops.

## Decision provenance (a design requirement, not an RQ)

Every node/decision carries a status ∈ `AI_hypothesis`, `source_text_observation`, `user_confirmed`,
`simulated_user_answer`, `deferred`, `analyst_approved`. LLM guesses are **never** auto-marked
`user_confirmed`. In automated experiments the simulated stakeholder's answers are recorded as
`simulated_user_answer` and **cannot** be reported as evidence about real human cost.

## Freeze (P1 gate)
Before P2/P3 implementation: finalize RQ1–RQ3 (and decide RQ4), fix the metric set, the quality threshold,
the exclusion rules, and the pre-registered comparisons; then write
`research/hypotheses-and-preregistration.md`. Do not re-define primary comparisons after seeing results.
