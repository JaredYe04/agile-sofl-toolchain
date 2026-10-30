# Novelty Assessment — Effort-Aware Incremental Refinement (P1 gate)

**Status:** **VERIFIED.** The internal prior-work boundary (section 2) is grounded in verified source
(`packages/`, `docs/25`, `docs/26`). The external literature (section 3) is now **verified** by the
literature agent against Crossref / arXiv / ACL Anthology / publisher records (full details in
`literature-notes.md`; machine-readable `literature-matrix.csv`). Paywalled papers (Tower, SOFL-2021
JSS) are **abstract-only** and flagged as such; no citation is invented (BLOCKERS B6).

**P1 gate decision: REVISE (recorded 2026-10-30).** See section 5.

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

## 3. External competing work (VERIFIED 2026-10-30)

Verified by the literature agent against Crossref / arXiv / ACL Anthology / publisher records.
Deep-read (full text): **OntoAgent, SAGE-Agent, Goal2Story, Agile-SOFL 2024 book**. **Abstract-only
(paywalled, no OA copy):** Tower, SOFL-2021 JSS. Full per-field detail in `literature-matrix.csv` and
`literature-notes.md`.

| Paper (verified) | What it does | Question selection | Formal/typed | Propagation | Cost measure | Difference to our contribution |
|---|---|---|---|---|---|---|
| **OntoAgent** — *From Chat to Interview… Experience Ontology* (Jin et al., arXiv:2605.05828, RE 2026) | 3-level ontology tree (aspect→dimension→slot), LLM-driven RE interview | YES (per-turn top-slot re-rank) but **not cost-aware** | **No** (set notation + slot tuples) | **No** (fixed parent-child; subtree prune) | turn count in TKQR; Likert | Has a question policy + tree, but **no typed semantics, no typed obligations, no provenance, no readiness policy, no decision propagation** |
| **Tower** — *User-Oriented Fuzzy Requirement Clarification…* (Zhang et al., IEEE TSC 19(3):1830–1843, 2026) **abstract-only** | feature tree as inquiry search space + "decision-making algorithm" + learned TowerLM | "decision-making algorithm"; **no cost formula in abstract** | not evident | not evident | **user simulator** (prospect theory + Fitts's law) | A user-simulator effort model (closest to stakeholder effort); we **abstract-only** so attribute only verified-abstract claims |
| **SAGE-Agent** — *Structured Uncertainty guided Clarification for LLM Agents* (Suri et al., Findings of ACL 2026) | structured-uncertainty belief over **typed** tool params + domains | **YES — EVPI:** `q*=argmax[EVPI(q,ℬ) − Cost(q,t)]`, Cost = aspect redundancy | **YES** (typed params, explicit domains) | **partial** (domain-constraint propagation; independent prob factorization) | question count (proxy) | **Establishes the cost-aware selection mechanism (EVPI−Cost). We adopt + cite it; our increment is the RE/formal-spec instantiation + typed obligations + provenance + readiness** |
| **Goal2Story** — (Zou et al., arXiv:2503.13279, 2025) | multi-agent fleet over Impact Mapping, fixed forward branching | **NONE** (no clarification loop) | No (JSON + NL) | one-way forward only | not measured | No question policy, no cost metric, one-way chain — different problem (generation, not interactive refinement) |
| **KAOS** — *Goal-directed requirements acquisition* (Dardenne/van Lamsweerde/Fickas, SCiP 20(1):3–50, 1993) | AND/OR goal trees + obstacles + refinement correctness (consistent/sufficient/complete) | N/A (formal method) | **YES** (Z-like predicate logic) | goal/obstacle dependency (tree) | N/A | Provides the **AND/OR goal formalism + refinement-validity criteria** we build on; we add the **runtime cost-aware planner + typed obligations + provenance + readiness + decision propagation** over a hybrid SOFL spec |
| **SOFL / Agile-SOFL** — Liu, JSS 178:110975 (2021) **abstract-only**; *Agile-SOFL* book (Springer, 2024, OA, deep-read) | 3-step hybrid spec (Informal→Semi-formal+GUI→Formal); SOFL modules, CDFD, FSF w/ `others`; `Decom` decomposition; leaf-process atomicity | **No automated policy** (human collaborative phase) | **YES** (typed data, invariants, FSF logic) | cross-decomposition var consistency + trace links (incl. developer-added) | not measured | **The base method we extend.** No automated cost-aware question selection; no typed refinement *obligations* with detector/discharge; no AI_hypothesis/user_confirmed provenance; no readiness policy; no runtime decision propagation |
| **NASA-TLX** (Hart & Staveland, *Adv. in Psychology* 52, 1988, pp.139–183) | cognitive-load instrument | N/A | N/A | N/A | 6-dim Likert | For the **P7 user study only**; automated experiments use **proxy** cost metrics, never reported as real load |
| **RE 2026 CFP** (ÉTS, Montréal, 17–21 Aug 2026) | venue | — | — | — | — | double-blind, **10 + 2 pages** |

### Verified per-contribution boundary (a–f)
- **(a) Typed requirement refinement tree + typed cross-links** → **PARTIALLY COVERED.** Each piece
  exists separately (KAOS AND/OR goals; OntoAgent ontology tree; Tower feature tree; SOFL typed data +
  `Decom` links; SAGE-Agent typed tool params) but **none** fuses a typed refinement tree **with typed
  cross-links as a first-class construct driving refinement**.
- **(b) Cost-aware question selection (expected gain / user effort)** → **ALREADY ESTABLISHED** for
  agent/tool-calling (SAGE-Agent `argmax[EVPI − Cost]`); **not established** for the RE/formal-spec
  target with a *stakeholder-effort* cost term. **We adopt (b) as prior art and cite SAGE-Agent.**
- **(c) Typed refinement obligations with explicit detector / evidence / discharge** → **POTENTIALLY
  NEW.** No surveyed paper models refinement steps as typed obligations to be *detected, evidenced,
  discharged*. Nearest precursors: KAOS goal-obstacles + refinement completeness/sufficiency; Agile-SOFL
  FSF `others` clause (an exhaustiveness device).
- **(d) Decision provenance (AI_hypothesis / user_confirmed / deferred) feeding a readiness policy** →
  **POTENTIALLY NEW.** No surveyed paper tags each decision with a provenance status and drives a
  *readiness* policy from it. Nearest precursor: Agile-SOFL trace links that distinguish
  developer-added elements (a provenance idea, not the pipeline).
- **(e) Cross-node *decision* propagation on a requirement graph** → **PARTIALLY COVERED.**
  Cross-node **constraint/domain** propagation exists (SAGE-Agent schema dependencies; Agile-SOFL
  cross-decomposition variable consistency), but **decision** propagation (a confirmed/rejected/refined
  node triggering re-evaluation elsewhere, without silent re-approval) is not established.
- **(f) Quality-vs-stakeholder-effort benchmark with simulated-user oracle + baselines** → **MOSTLY
  ESTABLISHED** on the simulator + baselines axis (Tower, SAGE-Agent/ClarifyBench, OntoAgent/
  ReqElicitGym). The specific **quality-vs-*stakeholder*-effort** axis and the **verified-hybrid-Agile-
  SOFL-spec** target are the less-covered dimensions.

## 4. Novelty boundary (draft; final once section 3 is verified)

**REVISED claim (after verification).** The **cost-aware question-selection mechanism is prior art**
(SAGE-Agent, `argmax[EVPI − Cost]`), so we **adopt and cite it** rather than claim it novel. The novel,
testable contribution is the **joint** of the remaining pieces, applied **over a verified hybrid
Agile-SOFL specification** — a target none of the surveyed papers occupies:

1. a **requirement-level typed structure with many-to-many cross-links** (G1+G2) driving refinement —
   distinct from the leaf-process atomicity model (I1) and the flat informal list (I6), and more
   specification-grounded than the ontology/feature/impact trees of OntoAgent/Tower/Goal2Story;
2. **first-class, detector-classified refinement obligations** (G3) — typed objects with a detector
   class (mechanical / LLM-candidate / user-decision), evidence, and an explicit discharge condition,
   **cross-node** (not only the within-module leaf gate of I1/I2); this detector/discharge *obligation*
   framing is not present in any surveyed paper (nearest: KAOS goal-obstacles + completeness, Agile-SOFL
   FSF `others`);
3. **explicit decision provenance** (G6) — every decision/obligation-discharge tagged
   `AI_hypothesis` / `user_confirmed` / `simulated_user_answer` / `deferred`, with the invariant that an
   LLM guess **never** becomes `user_confirmed` — feeding
4. an explicit **readiness policy** (G7) (verdict `READY`/`NEEDS_CLARIFICATION`/`DEFERRED`/`BLOCKED`/
   `INCOMPLETE_WITH_RISK`; budget exhaustion or "no more candidates" alone ≠ `READY`); and
5. **cross-node *decision* propagation** (G5) — a withdrawn/changed confirmed decision invalidates and
   re-evaluates dependent nodes **without silently re-approving** them.

The cost-aware **selection policy** (G4) — `priority(q) ≈ expected_quality_gain(q) /
(estimated_user_effort(q) + ε)` with a minimum-risk gate — is **instantiated from SAGE-Agent's
EVPI−Cost form** for the RE/formal-spec target with a **stakeholder-effort** cost term; it is the
*mechanism under test* in RQ3 and is a **hypothesis to be validated**, not an assumed fact. We do **not**
claim the selection mechanism itself is new.

**We do NOT claim:** that formal methods are universally better than informal; that a deeper or more
formal spec is intrinsically higher quality; that fewer questions are always better; that the cost-aware
selection policy is new or established theory; or that our checker proves semantic completeness of
natural-language requirements (I4: obligation closure only).

## 5. P1 gate decision: **REVISE** (recorded 2026-10-30)

The REVISE trigger fired: **SAGE-Agent (Findings of ACL 2026) already implements cost-aware,
expected-value question selection** (`q* = argmax_q[EVPI(q,ℬ) − Cost(q,t)]`, with a redundancy cost
term and typed parameters + partial domain-constraint propagation). So the **cost-aware selection
mechanism is prior art** and is **adopted and cited**, not claimed as our own. This is exactly the
scenario the pre-registered REVISE trigger named ("if section 3 shows that cost-aware clarification
already exists, drop the claim to the joint … over a verified hybrid spec"). Per task book §3.4, we do
**not** manufacture a "first" claim; we **shrink the contribution, record the pivot, and continue with
the reusable infrastructure + a reasonable research validation.**

**Re-scoped contribution (final, carried into the paper's contribution list):** the **joint** of
(1) requirement-level typed structure + typed cross-links, (2) first-class detector-classified
refinement obligations (detector/evidence/discharge), (3) explicit decision provenance, (4) an explicit
readiness policy, and (5) cross-node **decision** propagation, **instantiated over a verified hybrid
Agile-SOFL specification** with a cost-aware (SAGE-Agent-style) selector carrying a **stakeholder-effort**
cost term. No surveyed paper provides this joint for this target.

**Effect on the frozen design (none invalidate it; these re-scope claims/DVs only):**
- RQ3 ablation now **includes the SAGE-Agent EVPI−Cost form as a named, cited baseline mechanism**; the
  ablation isolates the *increment* of our obligations/provenance/readiness/decision-propagation over a
  cost-aware selector, not "cost-aware vs nothing."
- RQ1's "correct / complete / consistent / fewer unconfirmed policies" DVs are scoped to the
  **formal-specification target** (the produced `.asfl` + its requirement graph), consistent with §4.
- Related-work must cite SAGE-Agent (and OntoAgent/Tower/Goal2Story/KAOS/Agile-SOFL per
  `literature-notes.md`) and state plainly that the selection mechanism is adapted, not novel.
- All P2 design artifacts (typed structure, obligations, provenance, readiness, propagation, cost-aware
  selector) remain valid and are what we build; the design does not change, only the **framing of what is
  claimed novel** does.

**Not a PIVOT:** no competing work provides the full joint (typed structure + typed obligations +
provenance + readiness + decision propagation + evaluation) for a verified hybrid Agile-SOFL spec, so we
do **not** abandon the research direction.

## 6. Gate items (state)

- [x] Literature agent returned verified rows for section 3 (DOI/venue/year/authors + difference) →
      `literature-matrix.csv`, `literature-notes.md`, novelty §3.
- [x] GO/REVISE/PIVOT re-evaluated with verified external work → **REVISE** recorded (§5).
- [x] RQ1–RQ3 + metric set + quality threshold + exclusion rules frozen →
      `research/hypotheses-and-preregistration.md` (with the RQ3-ablation and RQ1-DV re-scoping noted in
      §5; the metric *definitions* are unchanged).
- [x] P2 conceptual model + ADRs finalized (`conceptual-model.md`, `DECISIONS.md` ADR-004).
- [ ] **P3 may now start** (task book §3.4): the gate has been passed with the REVISE scope recorded.
- [ ] P5/P6: new freeze tag (e.g. `exp-freeze-v1.3`) once P4 adds agent tools under
      `packages/studio/src` (freeze-guard `TOOL_PATHS` covers it; `packages/refinement` does not).
- [ ] Paper: cite SAGE-Agent + the others per `literature-notes.md`; RE 2026 = double-blind, 10+2 pages.
