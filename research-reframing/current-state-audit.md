# Phase 0 — current-state audit (code only)

Audit date: 2026-10-11. Tree: branch `research-reframing` at `353c1e6372c18048e7cefe3ae20f29b81cfcc1db` (same commit as `main`; subject `fix: 若干Bug`). This document records what the code does. It does not implement Decision-Aware Specification Refinement (DASR).

**Decision Ledger does not exist.** There is no decision record type, no decision store, no decision status, and no decision-to-element impact link. `ask_clarification` is a chat channel only.

No manuscript is in this checkout. There is no `.tex` / `.bib`. `docs/Aigle-SOFL.pdf` is gitignored and is not present. Claim rows below are the planned DASR properties P1–P4, not sentences from a paper PDF.

## 1. Freeze tag and experiment reproducibility

| Item | Value |
| --- | --- |
| Tag | `exp-freeze-v1.2` exists and points at `177749b6eebf9e48b864f168bf02acff198800f0` |
| Tag subject | `feat(studio): experiment freeze v1.2 — reasoning/thinking OFF for every agent LLM call` (2026-10-08 +0800) |
| Also present | `exp-freeze-v1` (`4355537`), `exp-freeze-v1.1` (`54b1fb0`) |
| `main` / this branch | `353c1e6`, **11 commits** after the freeze |
| Tool-path drift | `freezeStatus` in `packages/studio/scripts/agent-harness/freeze.ts` treats these paths as behaviour-bearing: `packages/{parser,studio,editor-api,aspec,gui,language-server}/src` plus the listed `package.json` files and `package-lock.json`. **94 files** under those paths differ between the tag and `HEAD`. A batch on `main` would fail the freeze guard (exit 2), which is what `packages/studio/scripts/agent-harness/README.md` states. |

Commits after the freeze that change tool or harness behaviour (oldest first):

- `fce5201` fault-injection summary (docs only)
- `d74e88f` lazy Chevrotain parser construction
- `b5948fb` L2 checks all scenario pairs under time budgets; unchecked pairs become one warning. Commit message says this is **main only, not in the freeze**
- `f4da375` lazy Z3 load
- `3a8b412` experiment batch runner (T, B2, B0-auto) and the freeze guard itself
- `3c0175c` per-step spec snapshots and full-checker counts
- `ad493a9`, `e702d7e`, `898c394` harness Windows normalisation, retry log, seeded schedule / `--stop-at` / `--resume`
- `c9be527`, `353c1e6` UI, syntax, and bug fixes on the studio

Write-gate file that **does not exist on the freeze**: `packages/studio/src/shared/asflRepair.ts` (`acceptHybridWrite`). It is new on `main`. Hybrid syntax gating, patch auto-repair, and the UI call in `applyHybridDocumentPatch.ts` are post-freeze. A pilot reproduced on `exp-freeze-v1.2` does not exercise `acceptHybridWrite`. Reproducing that pilot on `main` would also pick up the L2 checker change and the other 90+ tool-path edits. Harness scripts record their own sha256; they are not part of the freeze diff, but they were largely added after the tag (`freeze.ts`, `batch.ts`, `schedule.ts`, `steps.ts`, `b0auto.ts`).

Pilot **outputs** are not in git. `packages/studio/.harness/` is gitignored and is absent in this checkout. The plan’s figures (30 final specs, 18 judged unlike legal SOFL, 10 parser failures, auto-accept, eight steps, five repeats) cannot be recomputed from this tree. Do not treat this audit as a verification of those numbers.

What *is* in git under `experiments/fault-injection/` is a separate checker mutation study (2026-10-08 and a postfix rerun), tool commit `c9c67f7`, not the agent pilot. This audit does not re-score that study.

## 2. Every write path into specifications

Agent writes are proposals. Nothing is stored until a later apply step. The five propose tools are declared in `AGENT_TOOLS` (`packages/studio/src/main/services/llm/skills.ts`) and dispatched in `runAgentTurn` (`packages/studio/src/main/services/llm/agentLoop.ts`, the `propose_*` branch around the `allowed` check).

| Path | Tool / caller | Apply function | Persists through |
| --- | --- | --- | --- |
| Informal CRUD | `propose_changes` | `AgentPanel.applyPatch` → `useInformalSpec.applyPatch` → `patchInformalSpec` → `applyInformalSourcePatch` (`packages/aspec/src/informal/patch.ts`) | `useHistoryStore.applyDocument` on the `.aspec` tab |
| Informal source edit | `propose_source_edit` with `target: "informal"` | `useInformalSpec.applyPatch` → `applySourceEdits` (`packages/studio/src/shared/sourceEdit.ts`) | same history stack |
| Hybrid CRUD | `propose_hybrid_changes` | `applyHybridDocumentPatch` → `patchHybridSpec` → `applyHybridPatch` (`packages/editor-api/src/hybridPatch.ts`) then `commitHybrid` | history stack, **after** `acceptHybridWrite` |
| Hybrid refinement step | `propose_refinement_step` (single `refine-step` op) | `window.studio.refinementStep` → `applyProjectRefinementStep` (`packages/studio/src/main/services/refinementLog.ts`) then `commitHybrid` | `.asfl` via history, and `.agile-sofl/refinement-log.jsonl` |
| Hybrid source edit | `propose_source_edit` with `target: "hybrid"` | `applyHybridDocumentPatch` sees `isSourcePatch` → `applySourceEdits` then `commitHybrid` | history stack after `acceptHybridWrite` |
| GUI CRUD | `propose_gui_changes` | `applyGuiDocumentPatch` → `patchGui` | history stack. **No** `acceptHybridWrite` |
| GUI source edit | `propose_source_edit` with `target: "gui"` | `applyGuiDocumentPatch` → `applySourceEdits` | history stack. **No** `acceptHybridWrite` |
| UI auto-write | not a tool. `maybeAutoApply` in `AgentPanel.vue` when `settings.agentWriteMode === 'auto'` | same `applyPatch` as a human Apply | same as the target above. Skips the Apply click only |
| Headless pilot | `runOnce` in `packages/studio/scripts/agent-harness/core.ts` | `applyHybridProposal` | writes `hybrid.asfl` in the run directory. See bypasses |
| B0-auto (no LLM) | `runB0Auto` (`scripts/agent-harness/b0auto.ts`) | `refineAspecWithCheck` | writes `hybrid.asfl` directly |

`propose_source_edit` with a missing or ambiguous `target` is rejected in the agent loop (`propose_source_edit requires target...`). If only one of informal/hybrid write is enabled, the target is inferred.

### Non-agent writes (also mutate spec tabs)

These never pass `toolsFor`, `validateAgentPatch`, or the human Apply card.

| Path | Symbol | Gate |
| --- | --- | --- |
| Monaco buffer | `MonacoEditor.vue` → `history.applyDocument` | none |
| Hybrid visual editor | `useVisualModel.applySourcePatch` / `scheduleVisualPatch` | `visualEntityGuard.ts` only blocks duplicate names in the visual UI. The resulting text is not passed to `acceptHybridWrite` |
| Informal document / graphical edits, region panel, assist rail | `useInformalSpec.applyPatch`, `InformalRegionsPanel.vue`, `InformalAssistRail.vue` | informal patch diagnostics only |
| GUI designer | `useGuiModel.applySourcePatch` | none of the hybrid write gate |
| Find/replace | `packages/studio/src/renderer/search/applyReplace.ts` | none |
| Format document | `useFormatDocument.ts` | none |
| Batch Hybrid generator Apply | `HybridGenerateDialog.writeHybrid` | none. Agent mode of the same dialog only starts a session (`requestAgentLaunch`); the later write is a normal propose/apply |
| Refinement wizard / spec-assist skeleton | `RefinementWizard.vue`, `specAssist/hybridSkeleton.ts` | none of `acceptHybridWrite` |

Chat prose is not a write path. The system prompt tells the model that writes go through `propose_*` (`agentLoop.ts` `systemPrompt`). That is a prompt rule, not a store-level lock: the editor paths above write the same documents with no agent involved.

## 3. Write-gate predicates

**There are no symbols named `perm`, `guard`, `wf`, or `appr`.** A repository search does not find those identifiers as write-gate predicates. The checks that actually run, and the closest reading of those four names, are below.

### Permission — closest to `perm`

- Filter: `toolsFor` (`agentLoop.ts`). `propose_changes` needs `permissions.informal.write`. `propose_hybrid_changes` and `propose_refinement_step` need `permissions.hybrid.write`. `propose_gui_changes` needs either write bit. `propose_source_edit` needs either write bit. `ask_clarification` is always exposed.
- Second check, after the model calls a write tool: local `allowed` in the `propose_*` handler. Failure returns `No ${target} write permission.` and does not open a card.
- Defaults: `defaultAgentPermissions` is informal+hybrid read and write. `generationAgentPermissions` is informal read, hybrid read+write (`agentTypes.ts` `normalizePermissions`). Write implies read.
- Permission is checked when the proposal is built. `applyPatch` does not check it again.

### Retry block — not a predicate named `guard`

- `crudBlockedByFailures` (`agentPatch.ts`) rejects a **CRUD** proposal whose fingerprint equals `session.context.lastFailedWrite`. The tool result tells the model to call `propose_source_edit`.
- **Source mode is exempt:** `if (incoming.mode === 'source') return null`.
- A different CRUD fingerprint is allowed even after earlier failures. The “after two CRUD failures, block and require source edit” behaviour is prompt text plus `continuationUserText(..., failures >= 2)`, not a hard block on every subsequent CRUD.
- The identifier `guard` in `core.ts` (`for (let guard = 0; guard < 20; guard++)`) is a **loop cap** of 20 resumes. It is not a semantic predicate.
- CDFD `guard` fields and `visualEntityGuard.ts` are unrelated to the agent write gate.

### Shape check (before the card)

`validateAgentPatch` (`agentPatch.ts`):

- CRUD: non-empty operations; `replace-document` / whole-module dumps rejected; hybrid add/update/remove/replace-process-body need kind, name, or id; `refine-step` / `FormalizePredicate` / `ClassifyGrain` have required fields.
- Source mode: only `replace`, `append`, `replace-document`. `replace-document` is **legal** here and illegal on CRUD.
- GUI: allow-list of screen/widget/html ops.
- This checks the tool payload. It does not parse the resulting specification.

`normalizeHybridPatch` / `repairAsflSurface` (`asflRepair.ts`) rewrite `!=` → `<>`, drop a VDM prime, and rewrite `^` to `conc(...)` on hybrid proposal fields (`toText`, `fsf`, `pre`, `post`, `newText`, `text`) before the card is shown. An unrepairable `^` fails the proposal. `fromText` is not rewritten.

### Well-formedness — closest to `wf`

`acceptHybridWrite(before, after)` (`asflRepair.ts`):

1. Repair the **after** text (same surface rewrites).
2. Collect parser diagnostics via `setHybridWriteDiagnosticCollector` (production: `collectHybridAgentDiagnostics`).
3. If the repaired text has **more** `severity === 'error'` hits than `before` for the same `code:message` key, return `ok: false` and keep `before`. Warnings do not block. Pre-existing errors may remain.
4. Otherwise return the repaired text.

Call sites:

- UI hybrid commit: `commitHybrid` in `applyHybridDocumentPatch.ts`. If `window.studio.acceptHybridWrite` is missing, the write is refused (`Hybrid write gate unavailable`).
- Refinement service: `applyProjectRefinementStep` runs the gate **before** appending `refinement-log.jsonl`. The log’s `afterHash` is `contentHash` of the pre-repair text (`applyRefinementStep`). If repair changes the text, the stored hash is not the hash of the bytes written.
- IPC: `parseBridge.ts` handler for `acceptHybridWrite`.

Informal markdown and GUI HTML never call this function.

`DeclareAtomic` has a separate refusal inside `applyRefinementStep`: `canDeclareAtomic` (`packages/parser/src/refine/atomicity.ts`) requires `structurallyAtomic && grainClosed`. That blocks one refinement kind. It does not inspect decisions.

### Approval — closest to `appr`

- Default UI mode is `ask` (`readAgentWriteMode`, key `studio-agent-write-mode`). The user clicks Apply or Reject (`AgentPanel.applyPatch` / `rejectPatch`). Reject resumes with `{ action: 'rejected' }`.
- `auto` calls `maybeAutoApply`, which calls `applyPatch` with no user note and no approver id. The card is not left for a human. Stop during auto-apply resumes with `rejected` and `continueTurn: false`.
- The pilot harness **always** auto-approves hybrid proposals up to `maxApprovals` (batch default 8, `runOnce` default 3) and answers every clarification with a canned string (`DEFAULT_CLARIFICATION`: “Use your best judgement and continue without further questions.”).
- Telemetry `proposal_decision` (`resumeWithToolResult`) records `approved` / `rejected` / `error` for the patch. It does not record a person, a decision id, or affected elements.
- There is no override reason and no role field.

Nothing in this stack reads an unresolved-decision set. A syntactically legal patch that silently chooses a business interpretation is accepted.

## 4. Bypasses of the write gate

“The write gate” here means the deterministic hybrid check `acceptHybridWrite`, plus the proposal-time permission and shape checks. DASR’s decision gate does not exist, so every path bypasses it.

| Bypass | What it skips | Evidence |
| --- | --- | --- |
| **Source-edit fallback (by design)** | CRUD shape ban on `replace-document`; the same-fingerprint CRUD block | `validateAgentPatch` source branch returns ok for `replace-document`. `crudBlockedByFailures` returns null for `mode: 'source'`. Skills and `continuationUserText` tell the model to switch to source edit after CRUD failure |
| **UI hybrid source edit** | CRUD rules only. It still runs `acceptHybridWrite` | `applyHybridDocumentPatch` → `commitHybrid` |
| **Pilot `applyHybridProposal` source edit** | `acceptHybridWrite` entirely | `core.ts`: `isSourcePatch` → `applySourceEdits` and return. No call to `acceptHybridWrite` |
| **Pilot `applyHybridProposal` CRUD** | `acceptHybridWrite` entirely | same function: `applyHybridPatch` and return. Parser errors introduced by the patch are kept |
| **Pilot refinement step** | does call the gate | `applyProjectRefinementStep` → `acceptHybridWrite`. Empty-log `applyHybridPatch` `refine-step` is a different path and is used only when the harness does not take the single-step branch |
| **GUI CRUD and GUI source edit** | `acceptHybridWrite`, hybrid shape rules | `applyGuiDocumentPatch` |
| **Informal CRUD and informal source edit** | `acceptHybridWrite` | `useInformalSpec.applyPatch` |
| **Auto-write mode** | human Apply. UI hybrid auto-write still runs `acceptHybridWrite` because it uses `applyPatch`. It does not record an approver | `maybeAutoApply` |
| **Harness auto-approve** | human Apply, and for CRUD/source also `acceptHybridWrite`. Clarifications are not decided by a person | `runOnce` |
| **B0-auto** | agent tools, approval, and `acceptHybridWrite` | `runB0Auto` |
| **Monaco, visual editor, search/replace, format, generator Apply, wizard, spec-assist** | permission, shape check, approval, and `acceptHybridWrite` | section 2 |

`applyHybridPatch` of a `refine-step` calls `applyRefinementStep(source, [], step)` with an **empty log** and does not write `refinement-log.jsonl`. The UI single-step path does not use that; it uses `applyProjectRefinementStep`. A multi-op hybrid patch that embeds `refine-step` would update text without a durable log entry, then still face `acceptHybridWrite` in `commitHybrid`.

## 5. `ask_clarification` — channel only

Schema: `skills.ts` `ask_clarification` (`question`, `options[]`, `allowCustom`, `multiSelect`).

Runtime (`agentLoop.ts`): the assistant message gets a `ClarificationPrompt` (`agentTypes.ts`: id, question, options, allowCustom, multiSelect, pendingToolCallId, optional answer). The turn returns. No project-level record is created.

Answer path:

- UI encodes `{ selected, custom }` (`packages/studio/src/shared/clarificationAnswer.ts`). Custom text is kept even for single-choice.
- `resumeWithToolResult` stores a tool message `{ type: 'clarification_answer', selected, custom, answer }` and copies a display string onto `message.clarification.answer`.
- Sessions live in `<project>/.agile-sofl/agent/sessions/*.json` (`sessionStore.ts`). Fork/overwrite (`sessionBranch.ts`, `forkSessionRecord`) copies or truncates that transcript. It does not write a decision object.
- The harness substitutes `DEFAULT_CLARIFICATION` and continues. That answer is not a stakeholder decision record.

Absent fields relative to the plan’s `RequirementDecision`: stable decision id, source requirement ids, alternatives with ids, status (`unresolved` / `confirmed` / `rejected` / `superseded`), selected alternative, confirmedBy, confirmation evidence, affected element ids, revision, history. No query API lists “open decisions”. No migration marker says “none registered” versus “none exist”; the UI simply has no such concept.

An answered clarification does not constrain the next `propose_*`. The model is told to continue and may write any interpretation.

## 6. What α / “ambiguity” / refinement obligations actually are

The agent digest does **not** compute a natural-language ambiguity score. `formatRefinementDigest` (`packages/editor-api/src/refinement.ts`) says the spec is unambiguous only when five tool counters are zero. `docs/25-原子需求与精化度量机制.md` already says this is obligation closure, not a correctness proof. The digest string still uses the word `unambiguous`, and `dualLineRates.unambiguous` is that conjunction.

### Process counter

`analyzeProcessAtomicity` (`packages/parser/src/refine/atomicity.ts`):

```text
processAmbiguity =
  informalAtomCount
+ incompleteScenarioCount
+ openConditionCount
+ unbalancedBoundaryCount
+ undeclaredAtomicCount
+ emptyModuleCount
```

`structurallyAtomic` for a non-alias process is: no `decom`, no informal atoms, types defined, scenario coverage complete, process appears on the module CDFD, and not a stub. `undeclaredAtomicCount` counts those structurally atomic processes (the raw snapshot counts them **before** `DeclareAtomic`). Stubs increment `stubProcessCount` and are **not** a term in the sum. `docs/25` §4.1 omits `emptyModuleCount` from the displayed formula; the code adds it.

`buildRefinementState` then replaces the snapshot:

```text
processAmbiguity = max(0,
  snap.processAmbiguity - signed - grainBlocked + unloggedFormalizations)
```

- `signed`: structurally atomic, grain closed, and a `DeclareAtomic` log entry names that process.
- `grainBlocked`: structurally atomic but grain not closed (those processes are removed from this counter and carried on `grainAmbiguity` instead).
- `unloggedFormalizations`: informal-atom keys that disappeared since the last logged key set without a `FormalizePredicate` entry (`ASFL_REFINE_001`). Deleting informal text in the editor does not reduce the counter.

`breakdown.undeclaredAtomicCount` in the state object is the **ready** count (operationally atomic, not yet declared), not the raw snapshot field.

### Data counter

`checkDataRefine` (`packages/parser/src/refine/checkDataRefine.ts`):

```text
dataAmbiguity = givenTypeCount + missingRetrieveCount + openObligationCount
```

`buildRefinementState` subtracts the number of **distinct** `DischargeDataObligation` targets in the log (`dischargedDataCount`), floored at 0. That subtraction is by count, not by matching each open item. Per-item `discharged` is a separate flag (`dataItemDischarged`).

### Grain counter

`analyzeProcessGrain` (`packages/parser/src/refine/grain.ts`) extracts effect pattern, name/effect mismatch, and author-text variations (list-like phrases only). `closeProcessGrain` (`packages/editor-api/src/grainClosure.ts`) applies `ClassifyGrain` / `ResolveVariation` log entries. `obligations` emits ids such as `unclassified:`, `abstract-leaf:`, `mismatch:`, `mixed:`, `variation:`, `child:`, `scenario-gap:`.

```text
grainAmbiguity = sum(obligationIds) + unloggedGrainClosures
```

`grainClosed` is `obligationIds.length === 0 && (hasDecom || grainClass === 'operation')`. Sticky ids (`unclassified`, `abstract-leaf`, `mismatch`, `variation`, `mixed`) that vanish without `ClassifyGrain`, `ResolveVariation`, or `DecomposeProcess` increment `unloggedGrainClosures` (`ASFL_REFINE_002`). Rewriting pre/post does not by itself clear grain obligations. `canDeclareAtomic` requires grain closure.

### “Unambiguous” and the digest

`dualLineRates`: process rate = atomic leaves / expected leaves on the decom tree; data rate = discharged share (1 if there are no data items and no empty module); grain rate = 1 if `grainAmbiguity === 0`, else closed leaves / (closed leaves + grainAmbiguity). `overall` is the harmonic mean of the three rates, and is 0 if any rate is 0.

```text
unambiguous =
  processAmbiguity === 0 && dataAmbiguity === 0 && grainAmbiguity === 0
  && emptyModuleCount === 0 && stubProcessCount === 0
```

`nextSliceHints` turns open gaps into strings the prompt asks the model to offer via `ask_clarification`. That is a hint list, not a decision record. Closing every hint does not mean the stakeholder’s interpretation was confirmed.

### Digests and hashes (three different things)

| Hash | Function | Use |
| --- | --- | --- |
| Refinement log `beforeHash` / `afterHash` | `contentHash` in `editor-api/src/refinement.ts` (31-bit polynomial, hex) | audit line on each refinement step. Not SHA-256. Pre-repair text if `acceptHybridWrite` rewrites |
| Coverage staleness | `contentHash` in `aspec/src/buildInformalModel.ts` (`sha256:` + hex) | whole informal source vs `TraceabilityGraph.contentHash` |
| Pilot prompt / informal / harness | `promptHash`, `readInformal` sha256, `harnessSha` | experiment identity. Not a spec-element digest |

`read_refinement_state` returns `formatRefinementDigest` at `summary` | `tree` | `log` (`agentLoop.ts`). The log view is the last 24 refinement entries (kind, target, three counters before→after). It is not a decision history.

## 7. Trace links and impact tracking

What exists:

- **Generation traces.** `irToGenerationResult` (`packages/aspec/src/generators/ir.ts`) emits `SpecTraceLink` rows `informalId → process/type/invariant name` with relations `refines` / `derives-from` / `constrains` and confidence `0.7`. `refineToAsfl` `buildLinks` (`packages/aspec/src/refine/refineToAsfl.ts`) emits `TraceLink` rows with status **`covered` always**.
- **Coverage report.** `buildCoverageReport` (`packages/aspec/src/trace/coverage.ts`) marks items `stale` when `trace.contentHash` is set and differs from the current informal sha256. The flag is **document-global**: one informal edit stales every type, variable, invariant, and every process/function that has a trace link. It does not name which downstream element changed. It clears when a new trace is stored with the new hash. It is not a `needs-review` bit that stays until an explicit review transition.
- **GUI links.** `buildGuiTraceLinks` (`packages/gui/src/trace/coverageGui.ts`) sets `partial` or `missing` only. It never sets `stale`.
- **Refinement log.** Per step: kind, target string, both hashes, process/data/grain counters, informal key sets, sticky grain ids, optional `note`, `discharged`. This is an obligation journal. It does not record which requirement decision justified the edit.
- **Agent telemetry.** `llm-calls.jsonl` events include `proposal_decision` and `post_write_diagnostics` (parser / L1 / L2 counts). Condition names appear in run telemetry; the harness README says not to hand `runs/` to coders.

What does not exist: decision→element impact links, selective invalidation when one requirement or one decision changes, a rule that reading an element clears stale, or a report that impact is unknown rather than empty.

`TraceLinkStatus` includes `'stale'` (`packages/aspec/src/model.ts`) but the generator that builds links does not use that status.

## 8. Test coverage of gates and agent write paths

| Behaviour | Test | Gap |
| --- | --- | --- |
| `acceptHybridWrite` keeps a repaired postcondition; refuses a new syntax error (`@`) | `packages/studio/tests/asflRepair.test.ts` | No case for warnings-only, pre-existing errors that may remain, GUI, informal, or source-edit documents. No test that the **harness** apply path calls the gate (it does not) |
| `validateAgentPatch` rejects CRUD `replace-document` and `end_module`; allows them in source mode | `packages/studio/tests/agentPatch.test.ts` | No permission-denied test. `toolsFor` / `No hybrid write permission` are untested |
| `crudBlockedByFailures` blocks the same CRUD fingerprint and **never blocks source mode** | same file | The test locks in the source-edit bypass |
| Write-mode persistence `ask` default / `auto` | same file | Does not execute `maybeAutoApply` or assert that auto-write skips a human |
| Clarification encode/merge/custom-must-be-kept | `packages/studio/tests/clarificationAnswer.test.ts`, `clarificationDraft.test.ts` | No assertion that an answer creates a durable decision |
| Session fork around a clarification tool call | `packages/studio/tests/sessionBranch.test.ts` | Transcript only |
| Harness auto-approves and logs `proposal_decision` / `post_write_diagnostics` | `packages/studio/tests/agentHarness.test.ts` | Asserts auto-approve, not a human gate |
| Batch schedule, abort/resume, freeze-field presence on a manifest | `batchSchedule.test.ts`, `batchAbortResume.test.ts`, `batchRunner.test.ts` | No DASR condition flag |
| Atomicity / grain / CDFD counters | `packages/parser/tests/parser/cdfd.test.ts`, `grain.test.ts`, `packages/editor-api/tests/cdfdRefinement.test.ts`, `packages/studio/tests/atomicityTree.test.ts` | Obligation math only |
| Hybrid CRUD apply | `packages/editor-api/tests/hybridAgent.test.ts` and related patch tests | Patch mechanics, not a decision gate |
| GUI trace links | `packages/gui/tests/gui.test.ts` | No stale transition |
| Informal patch / generator trace rows | `packages/aspec/tests/informalMarkdown.test.ts` | `traceLinks.length > 0`; status not decision-aware |
| Coverage counts | `packages/aspec/tests/aspec.test.ts` `buildCoverageReport` | Asserts `missing` and `percent` only. No stale-hash transition |

No test covers: unresolved decision + dependent proposal blocked; unrelated proposal allowed; provisional vs confirmed; source-edit or GUI unable to skip a decision gate; auto mode unable to skip it; missing impact mapping failing closed; ledger reload; old projects showing “none registered”.

## 9. P1–P4 claim–code–test matrix

Labels: `implemented` / `partially` / `proposed` / `unsupported`. “Proposed” means specified in the restructuring plan and not in the code. DASR itself is entirely proposed.

| Property | Label | Current code | Test | Gap | Allowed wording now |
| --- | --- | --- | --- | --- | --- |
| **P1** No silent commitment of a tracked unresolved decision. A write that would store one interpretation as ordinary confirmed content is blocked, kept in clarification, or stored as explicitly provisional | **unsupported** | No decision records. `acceptHybridWrite` only compares parser error multisets. Approval confirms a text patch. Auto mode and the harness commit without a human. Source edit is the instructed escape hatch | `asflRepair.test.ts` covers syntax refusal only. `agentHarness.test.ts` covers auto-approve | Need a ledger, impact ids on every proposal (unknown ≠ none), and the same predicate on CRUD, source edit, GUI, refinement, and auto/harness apply | Do not claim the tool prevents silent commitment of unresolved requirements. You may say a hybrid UI/refinement write that introduces new parser errors is refused, and that this check is absent on the freeze tag and on the harness CRUD/source path |
| **P2** Traceability of commitment: for each decision that moves pending → confirmed and is used to change a spec, the log has source, confirming act, and affected elements | **unsupported** | Clarification answers sit in the session transcript. `proposal_decision` logs patch approved/rejected/error. Refinement log hashes obligation steps. Generation traces link informal ids to symbols at confidence 0.7. None of these is a decision confirmation record | `experimentTelemetry.test.ts`, `agentHarness.test.ts`, `sessionBranch.test.ts`, `informalMarkdown.test.ts` | Those logs can stay; they do not satisfy P2 | Do not claim confirmed requirements are traceable to a stakeholder decision. You may describe the refinement journal and the generation trace graph as separate mechanisms |
| **P3** Impact invalidation: a real change to a tracked upstream requirement or decision marks the affected downstream elements stale / needs-review, and does not reopen unrelated decisions. Unknown impact is reported. Stale clears only by an explicit review transition | **partially** | `buildCoverageReport` sets coverage items to `stale` when the **whole informal document** sha256 differs from `TraceabilityGraph.contentHash`. `buildLinks` never emits `stale`. GUI links never emit `stale`. No per-element impact, no decision reopen, no needs-review that survives until a review action. Regenerating the trace with the new hash clears stale | No targeted stale-transition test found under `packages/aspec/tests` | The flag is a document-hash coverage hint, not P3 | You may say coverage can show stale when the informal hash and the stored trace hash differ. Do not say the tool invalidates only the affected downstream elements, or that decisions are selectively reopened |
| **P4** Decision completion and refinement-obligation completion are different states. Neither means the specification is semantically correct | **partially** | Obligation completion exists: `dualLineRates.unambiguous` and the digest. `docs/25` says closure is not a correctness proof. Decision completion does not exist, so the two states are not both represented. The digest still calls obligation closure `unambiguous`, which is the conflation P4 is meant to stop | Parser/editor-api refinement tests cover the counters. Nothing asserts a separate decision-complete bit | Split the reported states; stop using `unambiguous` for obligation closure | You may report open refinement obligations (process, data, grain, empty modules, stubs) and say they are not semantic correctness. Do not report a single ambiguity number, and do not say “all decisions are confirmed” |

Adjacent wording that the code can support today, without DASR:

- The agent has a clarification **channel** and a human Apply/Reject card, with an auto-write switch and a harness that auto-approves.
- Hybrid writes that go through `commitHybrid` or `applyProjectRefinementStep` are refused when they add parser errors. That function is post-freeze.
- Three-line refinement obligations are computed and journaled. Closing them is not evidence of stakeholder intent.

## 10. Pilot harness locations (not deleted)

Source of the runner (tracked):

- `packages/studio/scripts/agent-harness/` — `core.ts`, `batch.ts`, `b0auto.ts`, `freeze.ts`, `schedule.ts`, `steps.ts`, `run.ts`, `informal.ts`, `prepare-v12.mjs`, `build.mjs`, `README.md`
- Build output, intended at `packages/studio/.harness/{run,batch}.mjs`, is gitignored (`/.gitignore` line `packages/studio/.harness/`)
- Default batch output: `packages/studio/.harness/batch-<time>/` with `runs/`, `blinded/`, `retries.log`, `batch.json`; key file outside the repo (`agile-sofl-batch-keys/`). See the README
- This checkout has **no** `packages/studio/.harness/` directory. Nothing under that path was deleted. If a later machine has pilot outputs there, leave them

`prepare-v12.mjs` checks out `exp-freeze-v1.2` into a sibling worktree and points that worktree at this checkout’s `packages/studio/.env` via `.harness/v12-origin.json`. Batches are specified to run on the freeze, not on `main`.

## 11. Phase 0 gate

| Gate 0 item | Status |
| --- | --- |
| Planned properties labeled | P1 unsupported, P2 unsupported, P3 partially, P4 partially. DASR not implemented |
| Every write path and every current bypass listed | Sections 2 and 4 |
| Decision Ledger | **Does not exist.** `ask_clarification` does not persist decisions |
| Pilot numbers recomputed | **Not possible from this tree.** Outputs are gitignored and absent. Fault-injection CSVs are a different study |
| Manuscript claim matrix | No `.tex` in the checkout |

No DASR types, tools, or gates were added in this change.
