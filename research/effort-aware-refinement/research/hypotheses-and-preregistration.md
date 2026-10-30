# Hypotheses and Pre-registration (P1 gate artifact)

**Status:** FROZEN (RQ structure, metric set, threshold, exclusions, comparisons). The overall GO
decision remains **conditional on the external-literature verification** in
`novelty-assessment.md` §3; if that verification triggers REVISE (see that file §5), only the RQ1
DV targets are re-scoped, never the metric definitions, the threshold, or the comparison family.
Nothing here is changed after any experimental result is seen.

This file pre-registers what the automated experiments will test and how. It implements task book
§3.3, §3.4, and §7 (P5). It is deliberately separate from the implementation so the benchmark,
oracle, scorer, and baselines cannot drift to fit results (task book §8, no test-set overfitting).

## 1. Research questions and null hypotheses (frozen)

**Primary RQs (paper carries these three; RQ4 is supplementary/conditional).**

- **RQ1 (quality).** At a comparable stakeholder-effort budget, does spec-semantics-guided, cost-aware
  refinement (D) produce requirements that are more correct, more complete (recall of reference
  decisions), more consistent (fewer contradictions / cross-node inconsistencies), and contain fewer
  unconfirmed policy assumptions, than A (free-form), B (static tree), or C (non-semantic adaptive)?
  - **H0(RQ1).** D does not differ from C on decision recall, precision, critical-behavior coverage,
    contradiction count, or unsupported-policy count.
- **RQ2 (effort at a quality threshold).** At a pre-registered quality floor (see §4), does D reduce
  stakeholder interaction cost relative to the baselines?
  - **H0(RQ2).** At the quality floor, D's interaction cost is not lower than C's (or B's / A's).
- **RQ3 (mechanism, ablation).** How much of D's benefit comes from (i) typed semantic obligations,
  (ii) cost-aware question selection, (iii) cross-node decision propagation?
  - **H0(RQ3).** Each of these components contributes not significantly to RQ1 / RQ2 outcomes.
- **RQ4 (scale/maintenance, supplementary, conditional on budget).** After requirements grow or change,
  does the mechanism avoid re-clarification and maintain consistency (a change invalidates / re-evaluates
  dependent nodes without silently re-approving them)?

**Independent variable:** method (A / B / C / D + ablations) crossed with task (fixed set) and seed.
**Dependent variables:** the quality DVs (§3.1) and the cost DVs (§3.2).

## 2. Compared methods (frozen; definitions in `research-questions.md` §Design)

- **A — Free-form dialogue.** Same base LLM, ordinary conversational elicitation; may ask the user and
  then emit the required target format.
- **B — Static tree.** Tree-structured decomposition; questions asked in a fixed static order; no
  semantic-obligation ranking.
- **C — Adaptive clarification.** Generic relevance / uncertainty / cost ranking; no Agile-SOFL
  semantic obligations.
- **D — Proposed.** Requirement-level typed tree + typed cross-links + semantic obligations +
  cost-aware selection + dependency propagation + approval/provenance + readiness policy.

**Primary contrasts (frozen):** D vs C (increment of formal semantics); D vs B (increment of the
adaptive mechanism); D vs A (overall practical benefit).
**Ablations (frozen):** `D − cost-aware`, `D − propagation`, `D − obligations`. If budget forces a
subset, it is cut in this pre-declared order (drop `D − obligations` pair-combos first, keep the three
single-component ablations) and the reduction is recorded in the protocol, never chosen after seeing
results.

**Baseline fairness (frozen, task book §7.2):** identical base model + temperature across methods;
identical task set, oracle, and information access; identical question/tool budget where comparable;
near-equal token/compute budget. Each group may use its own necessary internal structure, but the
D-only hidden reference requirements and scoring rubric are **never** placed in any evaluated method's
context (oracle isolation), and no baseline is artificially weakened. Total tool calls and resource cost
are recorded per run. Any OntoAgent / Tower-style baseline that cannot be reproduced from official code
is labeled an **"inspired baseline"** (not an official reproduction) and never endorsed by the original
authors (task book §7.2).

## 3. Operational definitions of the DVs (frozen)

### 3.1 Requirement quality (primary DVs)
- **decision recall** = (reference must-haves correctly recovered) / (all reference must-haves).
- **precision** = (supported / confirmed decidable claims) / (all decidable claims proposed).
- **critical-behavior coverage** = coverage of reference state / boundary / exception behaviors.
- **contradiction count** = number of contradictions, judged rule-based plus manual.
- **unsupported policy decisions** = number of high-impact policy entries in the final spec with **no**
  `user_confirmed` / `analyst_approved` provenance.
- **traceability integrity** = fraction of typed links that resolve to valid entities **and** are
  decision-backed.

### 3.2 Interaction cost (automated experiments; proxies, not real cognitive load)
- number of clarification questions;
- number of user actions / option-clicks / free-text answers;
- cumulative words/tokens the stakeholder must read and type;
- redundant questions (re-asking an already-decided item);
- elapsed wall time, **labeled as machine time** (not human time);
- total model input/output tokens, tool calls, and resource cost (currency + pricing date recorded).

### 3.3 Reporting rule (frozen, task book §7.4)
Do **not** synthesize an unexplained "overall score." Report the **quality-vs-effort Pareto curve** and
the cost **at** the quality threshold. A low question count at below-threshold quality is **not** a win.

## 4. Pre-registered quality threshold (the RQ2 floor)

A run "meets the quality floor" iff **all** of:
- decision recall ≥ **0.80**;
- unsupported policy decisions = **0**;
- critical-behavior coverage ≥ **0.70**.

These are pre-registered targets. They will be sanity-checked against pilot variance **before** the main
run; if the pilot shows the floor is impossible (no method can reach it) or trivial (all methods reach it
with zero cost), the floor is revised **once**, recorded here with a dated note and the reason, and the
main run uses the revised floor. No other revision is allowed after the main run starts.

## 5. Task set and oracle (frozen design; content finalized in P5)

**Task set (task book §7.1).** Pilot: 3 scenarios. Main: 8 to 12 tasks/variants covering at least
booking/cancellation/refund (state, time boundary, exception policy), e-commerce/order/inventory
(cross-process data consistency), task management (roles, dependencies, delete/restore), and access
control (authorization scope, hidden behavior, exception paths), plus non-functional / cross-module
constraint scenarios if budget allows. The two existing reference systems (`classroom.aspec`,
`delivery-trimmed.aspec`) are candidate seed tasks; the main set is authored and **independently reviewed
by the researcher** (not defined from any evaluated agent's output).

**Each task contains (frozen schema):**
- `initial_rough_story` (visible to all methods);
- `stakeholder_profile` or branch conditions (isolated from the agent);
- `reference_requirements` (independently reviewed; policy decisions, state conditions, exceptions,
  boundaries);
- multiple legal phrasings / paraphrases of each reference item;
- `answer_policy` (how the simulated stakeholder answers; unknown questions must be answerable as
  "unknown");
- `scoring_rubric` (correctness, coverage, wrong assumptions, cross-node consistency);
- `complexity_tags` (tree breadth, depth, interdependency, number_of_critical_decisions).

**Oracle (task book §7.3, frozen requirements).** Deterministic by default (seeded for the random
variant); must distinguish knows / does-not-know / refuses / defers; has a fixed policy and does **not**
change gold answers mid-interaction; answers irrelevant questions with unanswerable / refuse and does
**not** auto-complete missing defaults; gives semantic-equivalent answers across phrasings; records every
answer, its basis, the answer count, and the question type. Gold data is isolated behind a controlled
interface: the agent sees **only** question-response, never the oracle's scenario file. Deterministic and
seeded-random simulation are both supported.

**Anti-fabrication invariants (frozen, hard):** an LLM guess is **never** marked `user_confirmed`;
simulated answers are recorded as `simulated_user_answer` and are **only** reported as interaction
**proxies**, never as evidence about real human cognitive load. The harness's `UNMATCHED_CLARIFICATION_REPLY`
sentinel is preserved.

## 6. Statistical analysis (frozen)

- **Unit of analysis:** task × seed × method run. Paired (task/seed) comparisons.
- **Estimates:** point estimate + bootstrap 95% CI + effect size for each primary DV. A mixed-effects
  model (task/seed random) is used where the structure allows (task book §7.6).
- **Multiplicity:** the RQ1/RQ2 DV family is pre-declared with one primary metric per RQ; the rest are
  secondary, and the multiplicity risk is stated.
- **Significance is not the sole standard:** practical effect size and the extra engineering/inference
  cost are reported alongside.
- **Subgroup analysis (pre-defined):** by task complexity (independent vs strongly dependent; shallow vs
  deep; few vs many ambiguities).
- **Failure handling:** failed runs are retained in the logs and not silently dropped; technical-failure
  rules are pre-defined (§7).
- **Figures/tables** are generated automatically from raw logs by scripts; no manual alteration of paper
  figures (task book §7.6).

## 7. Exclusion and failure rules (frozen)

- A run is excluded from a DV only for a **pre-defined technical failure** (model interruption, harness
  crash, budget exceedance) recorded with its reason; the exclusion list and reasons are published with
  the results.
- No run is excluded for producing a "bad" answer, and no answer is edited post hoc.
- The runner enforces hard budgets (`--max-calls`, `--max-tokens`, `--max-cost`, `--max-seconds`) and, on
  interruption or budget exceedance, terminates safely and writes a recoverable partial log (task book
  §7.5, §7.7).
- `--dry-run` makes no paid calls (free deterministic mocks / local fixtures / score-replay only).

## 8. Budget and run plan (frozen; model source = the two authorized FREE APIs)

- **Model source (BLOCKERS B4):** only the authorized **free** endpoints (lab `lab-qwen3.8-27b`, ECNU
  `ecnu-max`). **No paid spend.** If free endpoints are insufficient, the affected sub-result is marked
  `not run: budget not authorized` (task book §7.5), never faked.
- **Smoke (P5 gate):** 1 scenario × 1 seed × all main groups, all mocks, to validate logs + scorer.
- **Pilot:** 3 scenarios × 2 seeds × 4 groups (≈ 24 runs), to find protocol problems.
- **Main (candidate, pre-registered here):** up to 12 tasks × 3 seeds × 4 groups (≈ 144 runs). The
  **actual** sample size is written into the run config after the pilot, based on budget + pilot variance
  + design, and is not chosen after the main run starts.
- Per run: fixed recorded seed, prompt version, and context-generation seed.

## 9. P1 gate decision (interim)

- **Interim: GO**, on the internal prior-work boundary (novelty-assessment §2, verified) and the frozen
  RQ/metric/threshold/comparison structure above.
- **Condition to lift to final GO:** the literature agent's verified rows (novelty-assessment §3) do not
  reveal a work that already couples requirement-level typed structure + cost-aware selection +
  propagation + readiness over a hybrid/formal spec. If a REVISE trigger fires, re-scope RQ1 DV targets
  only (per novelty-assessment §5) and record the pivot; keep the infrastructure and run a reasonable
  research validation (task book §3.4: do **not** manufacture a "first" claim).
- **Do not start P3 implementation before the final GO is recorded** (task book §3.4).

## 10. Versioning
- **v1 (this file):** frozen at the P1 gate. Any later change is appended as a dated v2+ entry with a
  justification; it never alters v1 in place.
- **v2 (2026-10-30, P1 gate passed with a REVISE scope decision — see `novelty-assessment.md` §5):**
  The P1 literature verification found that **cost-aware, expected-value question selection is prior art
  (SAGE-Agent, Findings of ACL 2026, `argmax_q[EVPI(q,ℬ) − Cost(q,t)]`)**. Consequences, applied **without
  changing any v1 metric definition, threshold, exclusion rule, or comparison family**:
  - The cost-aware selection **mechanism** is **adopted and cited**, not claimed novel.
  - **RQ3 ablation re-scope:** the baseline selector is now explicitly the SAGE-Agent EVPI−Cost form
    (instantiated with a stakeholder-effort cost term); the ablation isolates the *increment* of our
    typed obligations + decision provenance + readiness policy + cross-node decision propagation **over a
    cost-aware selector** (not "cost-aware vs nothing"). The ablation set `D − cost-aware`,
    `D − propagation`, `D − obligations` is unchanged.
  - **RQ1 DV re-scope:** "correct / complete / consistent / fewer unconfirmed policies" are scoped to the
    **formal-specification target** (the produced `.asfl` + its requirement graph). The DV *definitions*
    (§3.1) are unchanged.
  - The frozen contribution is the **joint** (typed structure + typed obligations + provenance +
    readiness + decision propagation) over a verified hybrid Agile-SOFL spec; related work cites
    SAGE-Agent and the others per `literature-notes.md`. **No metric, threshold, or comparison changes.**
