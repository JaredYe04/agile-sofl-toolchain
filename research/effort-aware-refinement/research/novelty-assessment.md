# Novelty Assessment — Effort-Aware Incremental Refinement (DRAFT, P1 gate)

**Status:** DRAFT. The **internal** prior-work boundary (section 2) is grounded in verified source
(`packages/`, `docs/25`, `docs/26`). The **external** literature section (section 3) is **pending
verification** by the dispatched literature agent; every external citation there must be checked
(DOI / venue / year / authors from the publisher page) before it enters the paper — **never invent
citations** (BLOCKERS B6).

Decision required at the P1 gate: **GO / REVISE / PIVOT**.

## 1. The claimed contribution (one paragraph)

A **cost-aware, semantics-informed clarification planner** that, given a rough requirement artifact,
refines it into a *verified* hybrid Agile-SOFL specification by deciding **which** clarification to ask
and **when to stop**, operating over a **requirement-level typed structure** (goal → feature →
process) with **typed cross-links** (many-to-many), **first-class refinement obligations** (each with a
detector class), **cross-node decision propagation** (a withdrawn/changed decision invalidates and
re-evaluates dependents), an explicit **decision-provenance** status (an LLM guess is never marked
`user_confirmed`), and an explicit **readiness policy**. The claim is bounded: it does **not** claim
"deeper tree = better", "more formal = better", or "fewer questions = better"; it claims that, at a
comparable or lower stakeholder cost, the produced requirements are **more correct, more complete,
more consistent, and contain fewer unconfirmed policy assumptions** than free-form dialogue, static
tree order, and generic cost-aware (non-semantic) clarification.

## 2. Internal prior work — what already exists (verified from source)

This is the part that most easily makes a reviewer say "this already exists." We must be precise about
what the repo **already** has, so the paper does not over-claim.

| # | Existing capability | Where (verified) | What it does |
|---|---|---|---|
| I1 | **Atomic-requirement refinement model** (leaf-process) | `packages/editor-api/src/refinement.ts`, `packages/parser/src/refine/atomicity.ts`; documented in `docs/25` | Bottom-up completion *within* the Hybrid module tree: a leaf process is *structurally atomic* (no `decom`, no informal atoms, types closed, scenario partition complete, on CDFD) and *operationally atomic* (single operation, no unresolved variations), then signed off by an auditable `DeclareAtomic` step. |
| I2 | **Dual-line + grain ambiguity measurement** | same; `docs/25` §3–4 | Separate counters for the process line, the data line (`retrieve`/`given`), and the grain line; harmonic-mean overall progress. An `unloggedFormalizations` guard means editing pre/post directly cannot silently clear the counters. |
| I3 | **Auditable refinement steps** | `packages/editor-api/src/refinement.ts`; `.agile-sofl/refinement-log.jsonl` | A closed set of step kinds (`FormalizePredicate`, `DecomposeProcess`, `DefineType`, `BindConstraint`, `DeclareAtomic`, `ClassifyGrain`, `ResolveVariation`, …) each recorded with before/after hashes and counter deltas. |
| I4 | **Explicit honesty rule** | `docs/25` §1.3, §10 | The docs state that **refinement-completeness is obligation closure, not a correctness proof**; the tool does **not** invent missing operations from a catalog (e.g. CRUD). This is a hard constraint on our claims. |
| I5 | **Mature LLM agent** | `packages/studio/src/main/services/llm/agentLoop.ts`, `skills.ts`, `experiment.ts`, `chatEcnu.ts` | OpenAI-compatible client; `ask_clarification` / `propose_*` / `read_*` tools; permission gates; a post-clarify read budget; experiment conditions T / B2; JSONL telemetry. **Clarification ordering is currently ad hoc** (the model chooses which question to ask). |
| I6 | **Trace-link provenance (bidirectional)** | `packages/aspec/src/model.ts` (`TraceabilityGraph`), `main/services/traceEngine.ts`; `docs/26` | Auto source binding between informal and hybrid nodes; change reminders; `workspace-v3.json` with UUIDs, transactions, cross-process locks. **Forward from modeling; recovery for existing artifacts.** |
| I7 | **Prior trace-recovery paper** | `docs/26` §3 | *"Improve Automatic Recovery of Trace Links from Natural Language Requirements to Formal Specifications with LLMs"* — a prior publication by the same group, about **recovering trace links from existing artifacts** (extract last-level FRs, organize process + declaration-dependency context, generative semantic matching). Must be cited and differentiated. |
| I8 | **Headless experiment harness** | `packages/studio/scripts/agent-harness/` (`core.ts`, `batch.ts`, `b0auto.ts`, `schedule.ts`, `freeze.ts`, `electron-stub.ts`); `tests/agentHarness.test.ts` | `runOnce` drives the real agent; block-randomized seeded schedule (Fisher-Yates per block), 429/503 backoff, resume, `--stop-at`, blinded outputs, per-step parser/L1/L2 diagnostics, a `resolveClarification` oracle hook, a B0-auto no-LLM baseline, an offline `--dry-run` fake-LLM path (no network, no key), and an anti-fabrication `UNMATCHED_CLARIFICATION_REPLY` sentinel. **Mocks electron and passes in this sandbox** (so P5/P6 is runnable here). |

### The gap (what is NOT present, verified)

The requirement-level structure today is a **flat informal list** (functions / data / constraints,
`aspec` `InformalModule`) plus the **formal process-decomposition tree** (`moduleGraph.ts`). They are
linked only by the `TraceabilityGraph` (`refines` / `constrains` / `uses`). There is **no**:

- **G1** requirement-level typed hierarchy **above** the process tree (system goal → domain goal /
  capability → user story / feature → process) with stable node IDs and versions;
- **G2** **typed cross-link kinds** beyond `refines`/`constrains`/`uses` (e.g. `depends_on`,
  `conflicts_with`, `satisfies`, `traces_to`) and **many-to-many** constraint semantics (a constraint
  constrains many nodes, which a tree cannot express);
- **G3** **first-class refinement obligations** as a typed, explainable object with a **detector class**
  (mechanical / LLM-candidate / user-decision) and a discharge condition (today the closest thing is the
  leaf-process atomicity gate, which is *within* a module, not across a requirement structure);
- **G4** **cost-aware question selection** (rank clarification candidates by expected quality gain over
  estimated stakeholder effort) — the agent currently asks in an ad-hoc, model-driven order;
- **G5** **cross-node decision propagation** (a change/withdrawal to a confirmed decision invalidates and
  re-evaluates dependent nodes rather than silently re-approving them);
- **G6** **explicit decision provenance** (a node's status ∈ `AI_hypothesis` / `user_confirmed` /
  `simulated_user_answer` / … with the invariant that an LLM guess can never become `user_confirmed`);
- **G7** an explicit **readiness policy** (a typed verdict `READY`/`NEEDS_CLARIFICATION`/`DEFERRED`/
  `BLOCKED`/`INCOMPLETE_WITH_RISK` with the rule that budget exhaustion or "no more candidates" alone does
  **not** imply `READY`).

## 3. External competing work (PENDING literature-agent verification)

> **Honesty marker:** the rows below are the *candidates to check*. They are **not yet verified**.
> The literature agent will fill in DOI / venue / year / authors and a one-line "how they differ" note.
> Any row that cannot be verified is marked `abstract-only` or dropped — **never invented** (B6).

| Candidate | Area | What it reportedly does | Difference to our contribution | Verification |
|---|---|---|---|---|
| OntoAgent (arXiv:2605.05828) | ontology-guided LLM requirement refinement | TBD | TBD (check: is it cost-aware? does it propagate decisions? is there a readiness policy?) | **PENDING** |
| Tower (IEEE TSC, DOI 10.1109/TSC.2025.3624915) | LLM requirement engineering | TBD | TBD | **PENDING** |
| SAGE-Agent (ACL Findings 2026) | agent for SE/RE | TBD | TBD | **PENDING** |
| Goal2Story (arXiv:2503.13279) | goal-to-user-story generation | TBD | TBD | **PENDING** |
| KAOS (Dardenne / van Lamsweerde / Fickas, 1993) | goal-oriented RE (AND/OR goal trees) | source of our AND/OR decomposition semantics | KAOS gives the goal-decomposition *formalism*; we contribute the **runtime cost-aware planner + obligations + propagation + readiness** over a hybrid SOFL spec, not a goal-modeling language | **PENDING** |
| SOFL (Liu, JSS 2021, DOI 10.1016/j.jss.2021.110975) | semi-formal OO specification | the base language we extend | SOFL/Liu provides Informal→Semi-formal→Formal and the qualitative "simple enough" stop rule; we make the **clarification order + stop** an explicit, testable, cost-aware policy | **PENDING** |
| NASA-TLX (Hart & Staveland, 1988) | workload measurement | reference for the **user study** (P7) cognitive-load metric | used to *measure* real stakeholder load in the (design-only) user study; our automated experiments use *proxy* cost metrics and never report simulated answers as real load | **PENDING** |
| RE 2026 CFP | venue scope | TBD (confirm target venue, page limit, deadline) | informs paper framing + section budget | **PENDING** |

## 4. Novelty boundary (draft; final once section 3 is verified)

**Our contribution is the planner + structure, not the language or the goal formalism.** Concretely,
relative to the verified internal work and (pending verification) the external work, the novel, testable
elements are the **joint** of:

1. a **requirement-level typed structure with many-to-many cross-links** (G1+G2), distinct from the
   leaf-process atomicity model (I1) and from the flat informal list (I6);
2. **first-class, detector-classified obligations** (G3) that are *cross-node* (not only the within-module
   leaf gate of I1/I2);
3. a **cost-aware clarification policy** (G4) — `priority(q) ≈ expected_quality_gain(q) /
   (estimated_user_effort(q) + ε)` with a minimum-risk gate — which is the *mechanism under test* in RQ3
   (it is a **hypothesis to be validated**, not an assumed fact);
4. **cross-node decision propagation** (G5) and **explicit decision provenance** (G6) — the anti-
   fabrication invariants (LLM guesses never become `user_confirmed`; simulated answers never reported as
   real cognitive load);
5. an explicit **readiness policy** (G7) with the rule that budget exhaustion ≠ `READY`.

**We do NOT claim:** that formal methods are universally better than informal; that a deeper or more
formal spec is intrinsically higher quality; that fewer questions are always better; that the cost-aware
policy is established theory (it is an ablation-tested hypothesis); or that our checker proves semantic
completeness of natural-language requirements (I4: obligation closure only).

## 5. GO / REVISE / PIVOT recommendation

**Interim recommendation: GO (proceed to freeze RQ1–RQ3 and start P2/P3),** conditional on the external
literature verification (section 3) not revealing a work that already couples a **requirement-level typed
structure + cost-aware question selection + decision propagation + readiness policy** for hybrid / formal
specification refinement. The internal gap (G1–G7) is concrete and verifiable, and the harness to test it
(I8) already runs in this environment.

**Trigger to REVISE** (narrow scope): if section 3 shows that cost-aware *clarification* for requirement
engineering already exists, we drop the claim to the *joint with formal Agile-SOFL semantics + cross-node
propagation + readiness over a verified hybrid spec* and re-scope RQ1's "correct/complete/consistent" DVs
to the formal-specification target.

**Trigger to PIVOT:** only if a competing work already provides the full joint (structure + cost-aware
planner + propagation + readiness + evaluation) for an equivalent target. That is not expected; the
internal gap and the task book both point to GO.

## 6. Open items before the gate is passed

- [ ] Literature agent returns verified rows for section 3 (DOI/venue/year/authors + one-line difference).
- [ ] Re-run the GO/REVISE/PIVOT decision with verified external work in hand.
- [ ] Freeze RQ1–RQ3 + metric set + quality threshold + exclusion rules → write
      `research/hypotheses-and-preregistration.md` (P1 gate artifact).
- [ ] Note for P5/P6: new freeze tag (e.g. `exp-freeze-v1.3`) will be required once P4 adds agent tools
      under `packages/studio/src` (the freeze guard's `TOOL_PATHS` covers it; `packages/refinement` does
      not).
- [ ] Do **not** start P3 implementation before this gate passes (task book §3.4).
