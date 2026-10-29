# Agile-SOFL Toolchain — Architecture Map (P0 audit)

Audited at commit `8f325df` on branch `research/effort-aware-refinement`.
Method: read-only source inspection (not README claims). All file paths verified to exist.

## 1. Monorepo layout (npm workspaces, `packages/*`)

| Package | Name | Role | Key deps |
|---|---|---|---|
| `packages/parser` | `@agile-sofl/parser` | `.asfl` lexer/parser (chevrotain) → AST, type/scope checking, FSF derive/classify, CDFD check, data-refine check, process atomicity & grain, z3 (SMT), CLI `asfl` | chevrotain 10.5.0, z3-solver |
| `packages/gui` | `@agile-sofl/gui` | `.gui.html` GUI spec parser/validator/patch, YAML-in-HTML schema | yaml |
| `packages/aspec` | `@agile-sofl/aspec` | Informal `.aspec` (YAML) parse/validate/patch; **refine→`.asfl`** (rule-based + LLM generator); **traceability + coverage**; book-align checks; project scan | @agile-sofl/gui, @agile-sofl/parser |
| `packages/editor-api` | `@agile-sofl/editor-api` | Stable JSON editor models + patch APIs; **refinement state machine** (`buildRefinementState`, `applyRefinementStep`, `formatRefinementDigest`); module/CDFD/graph layout | @agile-sofl/parser |
| `packages/language-server` | `@agile-sofl/language-server` (private) | LSP server wrapping parser diagnostics/completion | vscode-languageserver |
| `packages/vscode` | `agile-sofl` | VS Code extension (syntax, diagnostics, formatting, outline); bundles LSP; ships `.vsix` | — |
| `packages/studio` | `@agile-sofl/studio` (private) | Electron + Vue desktop IDE: agent, GUI design, trace workbench, persistence, Monaco | electron 28, vue, pinia, monaco, sql.js, echarts, elkjs |

Root `package.json` scripts: `build`, `test` (per-workspace, ordered), `bench:parse`, `coverage`
(parser), `check:boundaries` (`scripts/check-boundaries.mjs`). Node `>=18`; env Node v26.13.0.

## 2. Formal specification side (parser/aspec/editor-api)

### 2.1 Parser (`packages/parser/src`)
- AST: `ast/nodes.ts` (Program/Module/Process/Type/Var/Invariant/Function/CDFD/Refine/FSF/Predicate/Clause); `ast/guards.ts`, `span.ts`, `spanHelpers.ts`.
- Pipeline: `lexer/` → `parser/cstToAst.ts` → `transform/normalize.ts` → `scope/` + `typecheck/` → `fsf/deriver.ts`/`classifier.ts`/`l1Check.ts` (L1)/`l2Check.ts` (L2, z3) → `cdfd/checkCdfd.ts` → `refine/checkDataRefine.ts` → `refine/grain.ts`.
- **Refinement (existing):** `refine/atomicity.ts` → `analyzeProcessAtomicity()` returns `ProcessAmbiguityReport` with per-process `structurallyAtomic` and counters `informalAtomCount / incompleteScenarioCount / openConditionCount / unbalancedBoundaryCount / undeclaredAtomicCount / emptyModuleCount / stubProcessCount`. `canDeclareAtomic(row, {grainClosed})`.
- `parse(source)` → `{ ast, diagnostics }`; `check(source, {fsfL1})` → full diagnostics. Codes in `diagnostics/codes.ts` (`ASFL_*`, `ASFL_CDFD_*`, `ASFL_FSF_1xx/2xx`, `ASFL_DATA_*`, `ASFL_REFINE_00x`).
- `project/projectIndex.ts` — cross-file index. `transform/print.ts` (printRefineBlock), `xml.ts`.

### 2.2 aspec (`packages/aspec/src`) — informal + refine + trace
- `informal/` — YAML `.aspec` model (`model.ts`), parser, validator, **patch** (`patch.ts`), `inventory.ts`, `ids.ts`, `duplicateNames.ts`, `bridge.ts`.
- `refine/refineToAsfl.ts` → `refineToAsfl(document, source, options)` → `.asfl` + `TraceabilityGraph`; `fsfBuilder.ts`, `mergeAsfl.ts` (strategy ask/merge/rebuild), `guiBlockBuilder.ts`.
- **Generators:** `generators/ruleBased.ts` (deterministic, **API-free**) and `generators/llm.ts` (`llm-baseline`: LLM returns IR JSON, rule-based fallback on failure); `ir.ts`, `validate.ts` (`normalizeHybridIR`), `params.ts`. Top-level entry: `refineAspecWithCheck()`.
- `trace/coverage.ts` → `buildCoverageReport(aspec, asfl, trace)` (covered/partial/missing/stale), `mergeTraceability`, `parseTraceJson`; `updateTrace.ts`.
- `validateBookAlign.ts` (BOOK_ALIGN_001..009). Public API: `index.ts`.

### 2.3 editor-api (`packages/editor-api/src`) — refinement state machine (CORE to reuse)
- **`refinement.ts`:**
  - `RefinementStepKind`: FormalizePredicate | DecomposeProcess | BalanceFlows | DefineType | BindConstraint | DeclareAtomic | Extend | IntroduceRetrieve | DischargeDataObligation | SetCdfd | ClassifyGrain | ResolveVariation.
  - `RefinementLogEntry` (audit: before/after hashes + process/data/grain ambiguity deltas + informal/grain key sets) → persisted to `.agile-sofl/refinement-log.jsonl`.
  - `buildRefinementState(source, log, notes)` → `RefinementState` (counters, per-process `RefinementProcessRow` with `status: open|ready|atomic`, `effectPattern`, `grainClosed`, `operationallyAtomic`; modules; breakdown; dataItems; log).
  - `applyRefinementStep(source, log, step, notes)` → mutates source text, appends audit entry, recomputes. `DeclareAtomic` gated by `canDeclareAtomic`.
  - `dualLineRates(state)` → process/data/grain rates + harmonic `overall` + `unambiguous`.
  - `formatRefinementDigest(state, view)` → compact agent digest (`summary|tree|log`) + `nextSliceHints`.
- Patches: `processPatch`, `modulePatch`, `cdfdPatch`, `declarationPatch`, `invariantPatch`, `signaturePatch`, `guiPatch`, `extPatch`, `patch.ts` (decom). `moduleGraph.ts`/`moduleGraphLayout.ts`/`cdfdLayout.ts`/`cdfdGraph.ts`. `grainClosure.ts`. `specMaps/` (build spec maps from hybrid/gui). `visualParse.ts`, `hybridInventory.ts`, `filterDiagnostics.ts`, `mergeDiagnostics.ts`, `refinementLint.ts`.

## 3. Studio agent + persistence (the stack to REUSE, not rebuild)

Location: `packages/studio/src/main/services/`.

### 3.1 LLM agent (`services/llm/`)
- **`agentLoop.ts`** — `runAgentTurn(session, projectRoot, ctx, userText?, sink?, signal?)` + `resumeWithToolResult(...)`. Up to 14 steps/turn. `systemPrompt()` builds the agent persona + tool guide + live inventories. `loggedStream` → `chatEcnuStream` (OpenAI-compatible, streaming, tools). Tool dispatch: `ask_clarification` (returns, awaits user), `propose_*` (create `proposedChanges`, await Apply/Reject), `read_*` (inventory/source), `review_*`. **Post-clarify read budget** (`MAX_POST_CLARIFY_CONSECUTIVE_SPEC_READS=3`) caps consecutive spec reads after answered clarifications with no propose. Retry + abort handling. `AGENT_THINKING=false` (reasoning off, freeze v1.2).
- **`skills.ts`** — `AGENT_SKILLS` (8) + `AGENT_TOOLS` (12 OpenAI-style function schemas).
- **`chatEcnu.ts`** — `chatEcnu`/`chatEcnuStream`, `ChatMessage`/`ToolCall`/`ChatTool`, `ChatAbortedError`, `buildStreamBody`. **OpenAI-compatible**: Bearer key, model, tools, `thinking`, `max_tokens`, `stream_options.include_usage`. Config via `getEcnuConfig()` (`profiles.ts`); env `ECNU_API_KEY`, `ECNU_API_BASE_URL`, `ECNU_MODEL`, `ECNU_MAX_TOKENS`, `ECNU_CHAT_TIMEOUT_MS`. **Compatible with the authorized lab free API (`lab-qwen3.8-27b`)** — no new client required.
- **`experiment.ts`** — condition system: `AGILE_SOFL_CONDITION` `T` (full tool, default) vs `B2` (L1/L2 off); `B0`/`B1` external baselines (not in studio; run as T with warning). Per-call telemetry → `<project>/.agile-sofl/llm-calls.jsonl` (model, tokens, latency, condition, toolCalls; secrets scrubbed). `semanticDiagnostics`, `diagnosticCounts`, `getExperimentConfig` (reads `.agile-sofl/experiment.json` + env).
- `agentTypes.ts` — `AgentMessage`, `AgentSession`, `ClarificationPrompt` (options/allowCustom/multiSelect), `InformalPatchPayload`, `AgentSpecPermissions` (informal/hybrid × read/write), `postClarifyReadBudget`.
- `agentPatch.ts` (patch validation/fingerprint/failure tracking), `parseToolArgs.ts` (truncation recovery), `diagnosticPayload.ts`, `guiModuleGate.ts`, `sessionStore.ts` (persist sessions), `sessionBranch.ts`, `env.ts`.

### 3.2 Clarification & approval (renderer + shared)
- `renderer/components/workspace/agent/`: `clarificationDraft.ts`, `agentQueue.ts`, `agentToolUx.ts`, `patchSections.ts`.
- `shared/clarificationAnswer.ts` → `formatClarificationToolContent` (formats user answer → tool result: `selected` + `custom`).
- Apply/Reject → `resumeWithToolResult` with `action: applied|rejected|error` or `type: user_instruction` (free text while card open).

### 3.3 Trace system (`services/trace*` + `renderer/stores/traceability.ts`)
- `traceEngine.ts` (node identity, context, dependency, rule-based source conversion), `traceService.ts`, `traceRepository.ts`, `traceStructure.ts`, `traceTransactions.ts`, `traceProviders.ts`.
- Authoritative store: `<project>/.agile-sofl/trace/workspace-v3.json` (disk v3, DTO v2). Stable UUIDs, content-hash identity recovery, cross-process lock + atomic replace, transaction log, undo/redo integration.
- **Informal→hybrid provenance:** `propose_hybrid_changes` / `propose_refinement_step` / `propose_source_edit` accept `traceLinks: {sourceId, targetId, relation: refines|constrains|uses}`; every new semantic node requires provenance (validated at apply). This is the existing **typed cross-link** substrate — but relations are limited to `refines/constrains/uses`.
- Tests: `tests/trace*.test.ts` (`npm run test:trace`).

### 3.4 Persistence
- `projectService.ts` (Electron IPC `studio:project-*`); projects on disk (folders) + index DB `projectIndexDb.ts` (sql.js `studio-index.sqlite`); `projectManifest.ts` (`.agile-sofl` manifest), `projectTemplate.ts`.
- Artifacts: `.aspec`, `.asfl`, `.gui.html` files in project dir.
- Agent state: `sessionStore.ts` (sessions), `.agile-sofl/refinement-log.jsonl` (audit), `.agile-sofl/llm-calls.jsonl` (telemetry), `.agile-sofl/experiment.json` (condition), `.agile-sofl/trace/workspace-v3.json` (trace graph).
- Undo/redo: `renderer/history/` (kinds, types, index); `dualSave.ts`.

## 3.5 EXISTING EXPERIMENT HARNESS (P5/P6-critical — extend, do not reinvent)

`packages/studio/scripts/agent-harness/` is a **production-grade headless experiment harness** already
in the repo. Files: `core.ts`, `batch.ts`, `b0auto.ts`, `schedule.ts`, `freeze.ts`, `informal.ts`,
`run.ts`, `build.mjs`, `prepare-v12.mjs`, `electron-stub.ts`, `README.md`, tested by
`packages/studio/tests/agentHarness.test.ts`.

- **`core.ts` → `runOnce(o)`**: drives the **real** `runAgentTurn`/`resumeWithToolResult` with the real LLM,
  auto-approves each proposal and applies it through the **production** apply paths (`applyHybridPatch` /
  `applyProjectRefinementStep` / `applySourceEdits`), then resumes with `{action:'applied'}` so production
  logs `post_write_diagnostics`. Writes `runDir/hybrid.asfl`, `.agile-sofl/experiment.json`, and
  `manifest.json` (runId, promptHash, informalSha256, skillId, approvals, maxApprovals,
  clarificationsAnswered, stopReason, temperature). `stopReason ∈ {agent finished, approval budget reached,
  call budget reached, clarify_without_write}`.
- **`resolveClarification` hook** (`ClarificationAsk → ClarificationResolution`): the **simulated-stakeholder
  oracle** slot. Emits study events `clarification_asked` / `oracle_reply` (matched / matchedSlotIds /
  answerPreview). **Anti-fabrication:** with no oracle, `UNMATCHED_CLARIFICATION_REPLY` explicitly tells the
  agent NOT to invent business defaults. `promptHash(...)` hashes everything that must be identical across
  conditions (input, skill prompt, user text, answers, temperature) — the baseline-fairness mechanism.
- **`install429Retry`**: serial 429/503 exponential backoff + `retries.log`.
- **`batch.ts`**: block-randomized batch runner (mulberry32 PRNG, `--seed`, `--systems`, `--conditions`,
  `--repeats`, `--stop-at`, `--resume`, freeze guard re-checking tool commit / harness sha256 / prompt
  hashes / informal inputs). Outputs `blinded/<runId>/final.asfl` + `steps/<n>.asfl` (blind coding),
  `runs/<runId>/` (manifest, `final-diagnostics.json`, per-step parser/L1/L2 counts, `llm-calls.jsonl`),
  `batch.json` (status, stepSummary). Condition **`B0-auto`** = the rule-based generator
  (`@agile-sofl/aspec` `refineAspecWithCheck`), **no LLM calls**.
- **`freeze.ts` / `prepare-v12.mjs`**: the harness enforces a **frozen tool state** (originally
  `exp-freeze-v1.2` @ 177749b) so batches are reproducible. **Implication:** new method conditions
  (B/C/D) are **additive** — they do not change the frozen tool state the baselines rely on. The D method is
  an extension to `runOnce` (new tools + new `resolveClarification` policy + new condition label), keeping the
  harness's existing guarantees.
- **`informal.ts`**: BOM-strip + CRLF→LF normalization (Windows/Linux equivalence).

**Design consequence:** P5/P6 **reuse** `runOnce` + `batch.ts` + telemetry/manifest/blinding. My increment =
(a) a deterministic **simulated-stakeholder oracle** (implements `resolveClarification` with per-task
`answer_policy`, knowns/unknowns/defers), (b) the **method conditions** (A free-form / B static tree /
C adaptive / D proposed + ablations) wired into the batch runner + `experiment.ts`, (c) the **scorer** that
reads `final.asfl` + `llm-calls.jsonl` + `steps.jsonl` + study events and computes quality-vs-effort metrics.
This keeps the existing T/B2 baseline experiment intact.

## 4. Reusable interfaces for the research (what I build ON)

- **Read refinement state:** `read_refinement_state` tool / `buildRefinementState` + `formatRefinementDigest`.
- **Ask user:** `ask_clarification` tool (options + custom + multiSelect) + `ClarificationPrompt` + `formatClarificationToolContent`.
- **Propose auditable change:** `propose_refinement_step` (12 kinds) + `traceLinks` provenance.
- **Permissions:** `AgentSpecPermissions` gates.
- **Experiment conditions + telemetry:** `experiment.ts` (add A/B/C/D conditions) + `llm-calls.jsonl` (per-call cost).
- **Deterministic offline fallback:** `ruleBased.ts` generator (API-free) for mock replay.
- **Free LLM client:** `chatEcnuStream` (OpenAI-compatible) → point at authorized lab/ECNU API.

## 5. What does NOT yet exist (the research gap)

1. **No requirement-level refinement structure** above the process tree: goal → capability → user story/feature → process. (Process tree is module→process; informal is a separate functions/data/constraints list, linked only by `traceLinks`.)
2. **No typed cross-link kinds** beyond `refines/constrains/uses`: missing `depends_on`, `conflicts_with`, `satisfies`, `traces_to`, and AND/OR decomposition semantics.
3. **No refinement *obligations* as first-class typed entities** with detector/evidence/discharge. (Existing ambiguity *counters* + *grain* obligations are process-formal; no requirement-level obligation taxonomy, no cost/benefit annotation, no provenance on the obligation.)
4. **No cost-aware clarification question-selection policy.** `ask_clarification` is invoked by the LLM ad hoc; no ranking by expected quality gain / user effort. The only "policy" is the post-clarify read budget (a cost *cap*, not a selection function).
5. **No readiness-policy concept** beyond `unambiguous` (counters==0). No `READY/NEEDS_CLARIFICATION/DEFERRED/BLOCKED/INCOMPLETE_WITH_RISK` with explicit risk acceptance.
6. **No benchmark, simulated-stakeholder oracle, or baseline harness** outside the studio. (`experiments/fault-injection/` exists but is unrelated — it is a mutation-based checker-validation study, RQ3 "no LLM".)
7. **No explicit decision-provenance status** distinguishing `AI_hypothesis` vs `user_confirmed` vs `simulated_user_answer` vs `deferred` vs `analyst_approved`.

## 6. Design direction (minimal, compatible)

New research increment lives in a **new package** `packages/refinement` (typed domain layer) that:
- Adds `RequirementNode` / `RefinementEdge` / `RefinementObligation` / `RequirementDecision` / `ReadinessAssessment` that **reference** existing informal node ids and hybrid AST ids (via the existing trace-link substrate) — not duplicates.
- Adds a **deterministic, offline** obligation checker + cost-aware question selector (unit/property-testable without any LLM).
- Integrates with the agent as new typed tools (`check_refinement_obligations`, `list_open_decisions`, `assess_readiness`, `compute_change_impact`, `propose_clarification`, `record_decision`) and new experiment conditions for the method groups.
- The benchmark/oracle is a standalone headless harness driving the same agent tools against fixtures + the free model, reusing `llm-calls.jsonl` telemetry for cost.

See `adr/` for the formal decisions.
