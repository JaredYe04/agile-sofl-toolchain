# Literature Notes — RE clarification / refinement (P1)

**Source:** the dispatched literature-verification agent. Every citation below was verified against
Crossref / arXiv / ACL Anthology / the publisher record, **not** from memory. Deep-reads (full text)
were done for **OntoAgent, SAGE-Agent, Goal2Story, and the open-access Agile-SOFL 2024 book**.
**Tower (IEEE TSC)** and the **SOFL-2021 JSS paper** are paywalled with **no open-access copy**
(Unpaywall `is_oa:false`), so they are **abstract-only** — do not attribute mechanisms/stop rules /
baselines/metrics to them beyond the verified abstract. Full matrix: `literature-matrix.csv`.

## The five papers + two anchors

### 1. OntoAgent — "From Chat to Interview: Agentic Requirements Elicitation with an Experience Ontology" (Jin et al., arXiv:2605.05828, RE 2026)
- **Problem:** automated RE **interview** from an underspecified description; surface **implicit**
  requirements, avoid redundant questions.
- **Mechanism:** three-level **ontology tree** `𝒯=(𝒜,𝒟,𝒮,π_D,π_S)`: Aspects (expert top partition) →
  Dimensions (LLM-induced) → **Slots** `S=⟨k,q⟩` (clarifiable item + candidate question). All reasoning
  is LLM prompting with rule-based constraints.
- **Question selection:** **YES** (Algorithm 1): `ScoreOnto` → per-turn `ReRankOnto` (re-rank candidate
  slots under the active branch using dialogue history, pick top) → `GatePrune` → `QuestionGen`.
  The ontology decides **which** slot; the LLM writes the **question**. **Not cost-aware** (no
  effort/cost term).
- **Stop:** no eligible slots remain, or max-turn budget (20). **No formal semantics** (set notation +
  slot tuples). **No cross-node propagation** (fixed parent-child; subtree pruning; no distant-node update).
- **Cost measure:** turn count `n` (folded into TKQR via log₂ discount); ~20-min human sessions; 7-point
  Likert "Questioning Efficiency" 5.79 vs best baseline 5.26. **No NASA-TLX.**
- **Baselines/datasets:** 5 free-form-LLM baselines; ReqElicitGym (101 web-app scenarios), WebGen-Bench
  train split, 2 real human-eval scenarios (Salon, Ski Resort). **Limitations:** only 6 human-eval
  participants, web-only domain.
- ⚠ The phrase **"Experience Typology" is NOT in this paper** — it uses "experience **ontology**."
  Do not cite it as "Experience Typology."

### 2. Tower — "User-Oriented Fuzzy Requirement Clarification for Agent Services Delivery Based on LLMs" (Zhang et al., IEEE TSC 19(3):1830–1843, 2026, DOI 10.1109/TSC.2025.3624915) — **abstract-only**
- **Problem (abstract):** clarify **"fuzzy requirements"** for agent services delivery via multi-turn
  interaction.
- **Mechanism (abstract):** a **feature tree** as the **search space for inquiries**, refined with user
  profiles + "diverse interview questioning strategies"; a **Tower** decision-making algorithm; a learned
  **TowerLM** model. **No EVPI/cost formula in the abstract**; stop rule, formal semantics, and
  propagation **not evident** (paywalled).
- **Cost measure (abstract):** a **user simulator** modeling personality via **prospect theory +
  Fitts's law** — the closest analog to stakeholder-effort modeling, but a *simulator*, not a measured load.
- **Datasets:** a self-built 5-domain benchmark with user profiles + 4 public datasets (names not in
  abstract). Cite **only** the verified abstract claims.

### 3. SAGE-Agent — "Structured Uncertainty guided Clarification for LLM Agents" (Suri et al., Findings of ACL 2026 pp.40811–40838, DOI 10.18653/v1/2026.findings-acl.2028) — **PIVOTAL**
- **Problem:** tool-calling LLM agents fail on **ambiguous/incomplete** instructions; decide when to
  clarify, ask, then make the correct tool call (Explicit / Ambiguous / Infeasible).
- **Mechanism:** a **structured-uncertainty** belief over **typed tool parameters + domains**; separates
  specification uncertainty from model uncertainty; belief update by domain intersection.
- **Question selection:** **YES — EVPI-based.** `EVPI(q,ℬ)=𝔼_r[max_c π_c(t|q,r)] − max_c π_c(t)`;
  select `q*(t)=argmax_q[EVPI(q,ℬ(t)) − Cost(q,t)]` where `Cost(q,t)=λ·Σ_{a∈𝒜(q)} n_a(t)` (aspect
  redundancy; λ=0.5). **This is exactly "cost-aware, expected-value question selection."** Raising λ
  0→0.5 cut questions 18–27% with <3% accuracy change.
- **Stop:** `max_c π_c ≥ τ_exec`, or `max_q Score < α·max_c π_c`, or step budget.
- **Formal/typed:** **YES** (typed params with explicit domains; candidate call = partial function).
- **Propagation:** **YES, partial** — domain-constraint propagation (schema dependencies, one param's
  value restricts another's options) despite an independent probability factorization.
- **Cost measure:** **clarification question count** (a proxy; 1.5–2.7× reduction); coverage +7–39%.
- **Datasets:** ClarifyBench (716 samples / 5 domains / 92 tools; κ=0.76), When2Call/BFCLv2.
- **Implication for us:** SAGE-Agent already establishes the **cost-aware question-selection mechanism**
  (EVPI − Cost). We **adopt and cite it** as prior art, and claim the **RE / formal-spec instantiation**
  with a **stakeholder-effort** cost term and a **typed-obligation + provenance + readiness** driver as
  the increment (see novelty-assessment §4/§5).

### 4. Goal2Story — "Goal2Story: A Multi-Agent Fleet … for Impacting Mapping on Requirements Elicitation" (Zou et al., arXiv:2503.13279, 2025)
- **Mechanism:** a multi-agent **fleet** (Captain/Intel/Delivery/Tactical/Format-Doctor) over **Impact
  Mapping** (Why/Who/How/What), **fixed forward branching** (n=2 per stage → 8 USs). **Not** a searched
  graph.
- **Question selection:** **NONE** (no interactive clarification loop; purely sequential).
- **Stop:** structural — one traversal; a story is "ready" when it passes a format gate (valid JSON) +
  a QuACE quality gate. **No formal semantics** (JSON + NL). **Propagation:** one-way forward
  accumulation only; **no** bidirectional update / feedback / cross-tree re-satisfaction.
- **Cost:** **not measured** (3-person validator panel only). **Datasets:** StorySeek (1,005 records).

### 5. KAOS — "Goal-directed requirements acquisition" (Dardenne, van Lamsweerde, Fickas, *Science of Computer Programming* 20(1):3–50, 1993, DOI 10.1016/0167-6423(93)90021-g)
- **The method:** object-oriented **goal modeling** with **AND/OR refinement trees**, **goal obstacles**
  (refinement/verification drivers), **refinement correctness** (consistent / **sufficient** /
  **complete**), and **responsibility assignment** (leaves assigned to system / other agents / external
  entities). **Formal** (Z-like predicate logic, pre/post).
- **Citation caution:** the **SCiP-1993 paper is the safe, DOI-verified KAOS reference**. The
  Computer-Journal "KAOS Method" (1993) paper and a "1993 IEEE Software" Dardenne paper **could not be
  re-verified** here (Oxford DOI 404 / not in Crossref) — **do not** cite their exact page ranges or
  that IEEE Software paper without separate verification.

### 6. SOFL / Agile-SOFL (two rows)
- **6a. JSS 2021** — "A three-step hybrid specification approach to error prevention" (Liu, *JSS*
  178:110975, 2021, DOI 10.1016/j.jss.2021.110975) — **abstract-only**: proposes the **hybrid
  specification** concept + a three-step approach; controlled experiment shows it prevents **28.36%
  more errors** than a comparable traditional method.
- **6b. Agile-SOFL 2024 book** — Liu, *Springer Nature Singapore*, 2024, ISBN 978-981-97-2285-3,
  DOI 10.1007/978-981-97-2285-3 — **OPEN ACCESS, deep-read**. Three steps: **Informal** (Functions /
  Data / Constraints) → **Semi-formal + GUI (UIS)** → **Formal (critical processes only)**. SOFL
  modules, **CDFDs**, **FSF** = disjunction `T_i && D_i` with an `others` clause (an explicit
  exhaustiveness device). Process decomposition via the **`Decom`** link (`X_Decom`); three explicit
  decomposition rules; **leaf-process atomicity** = a not-decomposed process defined by its own FSF.
  **Formal/typed.** **No automated question policy** (clarification is a human collaborative phase);
  **no runtime decision propagation** (cross-decomposition variable-consistency constraint + trace links
  only, including links to developer-added elements — a provenance idea). **This is the base method our
  work extends.**

### Anchors
- **NASA-TLX:** Hart & Staveland, "Development of NASA-TLX (Task Load Index)…", in *Human Mental
  Workload*, *Advances in Psychology* vol. 52, Elsevier, 1988, **pp.139–183**, DOI
  10.1016/S0166-4115(08)62386-9. The canonical citation is this **Elsevier book chapter**, not a 1988
  *Human Factors* article. (For the P7 user study only; our automated experiments use **proxy** cost
  metrics, never reported as real cognitive load.)
- **RE 2026 CFP:** double-blind; **10 pages main body + up to 2 pages references** (≤12); host **ÉTS,
  Montréal**; **17–21 Aug 2026**.

## Cross-cutting honesty flags (carry into the paper)
1. "Experience **Typology**" does not exist in arXiv:2605.05828 — it is "Experience **Ontology**."
2. Tower and the SOFL-2021 JSS paper are **abstract-only** — attribute only verified-abstract claims.
3. Cite KAOS as the **SCiP-1993** paper; do not cite the unverified Computer-Journal / IEEE-Software
   KAOS records.
4. NASA-TLX = the **Elsevier 1988** book chapter.
5. RE 2026 = double-blind, 10+2 pages.
