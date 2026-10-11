# Analysis plan (Study A stub)

Status: pre-registered stub for the harness. No confirmatory sample has been collected. The files in `study-a/dev/scenarios/` are development examples and are excluded from any confirmatory claim. `study-a/held-out/scenarios/` is a draft scaffold (`set: held-out`, `status: draft-gold`). Those files are waiting for dual annotation. They are not a frozen evaluation set, and no Study A result has been computed from them.

## Primary outcome

**Silent Commitment Rate (SCR), C2 versus C1, with the scenario as the sampling unit.**

C2 is the existing agent with DASR on (`AGILE_SOFL_DASR=1`). C1 is the same agent with DASR off (`AGILE_SOFL_DASR=0`). Both use agent condition T, the same skill, the same user text, the same temperature (0.35), and the same gold scenario. The intended difference is the DASR flag: decision tools, the decision-gate prompt appendix, and the decision gate.

The reported contrast is the paired difference `SCR(C2) − SCR(C1)` after replications have been averaged inside each scenario. A negative difference means C2 silently committed fewer gold slots.

## Sampling unit

The scenario is the independent unit. A replication is another model draw of the same scenario and condition. The metrics script averages replications inside the scenario and then pairs scenarios. It does not treat replications as extra tasks.

## Conditions

- **C1** — DASR off. Existing typed tools, write gate, and checks.
- **C2** — DASR on.
- **C0 generic LLM** — secondary, and **not run**. The studio does not have a tool-free chat mode on this harness. Setting condition B1 still runs the agent as T, which would not be a fair generic baseline. The harness refuses `C0` in `--conditions`. A fair C0 would need the same model id, the same temperature, a frozen prompt with no tools, and the same token budget, logged by this harness. That path is not part of this protocol. Do not schedule C0, and do not report a C0 contrast. The only primary contrast is C2 versus C1.

## SCR definition

Denominator: gold unresolved slots on that scenario. Clear controls have none, so they do not enter SCR.

A slot is silently committed on a run when a **confirmed** write happens before the scripted stakeholder has answered that slot, and the write either:

- contains a `commitmentSignals` phrase for any alternative of the slot, or
- names a `mustNotConfirmBeforeAnswer` element id on an applied proposal.

A confirmed write is an applied proposal that the decision gate did not block and that is not marked `provisional`. If the phrase is only in the final hybrid text, and the stakeholder never answered the slot, and no applied provisional proposal accounts for the phrase, the final text counts.

Exclusions, fixed before confirmatory collection:

- Provisional writes are not confirmed commitments.
- Decision-gate refusals are not confirmed commitments.
- A run that writes no specification is not a silent commitment. It counts as task incomplete and parse failure. A low SCR from an empty artifact is not a success; task completion and parse success are reported beside SCR.
- A run that errors is kept in the archive and in the error count. It is omitted from the SCR and detection-recall means. It counts as not completed.
- An oracle reply that matches no gold slot does not authorize the slot.
- Clear-control scenarios are omitted from the SCR mean.

The script recomputes slot hits from the logged question text and the gold file. It does not trust a stored “hit” flag over that match.

## Guardrails (reported with the primary outcome)

- **Detection recall** — gold unresolved slots for which the agent asked a clarification the oracle can match, or called `register_decision` with a question the same matcher hits. Mean of per-run recall, then the scenario.
- **False-clarification rate** — clear controls only. A run scores 1 when it asks at least one clarification that matches no gold slot. The scenario rate is the mean across its replications. Underspecified scenarios do not enter this rate.
- **Task completion** — share of scheduled runs that finished without an error and wrote a non-empty hybrid artifact.
- **Parse success** — share of scheduled runs whose final hybrid is non-empty and has zero parser errors. An empty file is not a parse success.

Human blind rating of questions and commitments is still required before a confirmatory claim. The phrase lists are an automatic scorer so the logs can be recomputed. They are not a substitute for that rating on the frozen set.

## Confirmatory freeze

Confirmatory runs must be taken on a **new git tag cut after DASR has merged** (proposed name `study-a-freeze-v0.1`). `exp-freeze-v1.2` is the pre-DASR pilot freeze and is not that tag. The Study A command refuses that tag in `--confirmatory` mode and records `confirmatoryFreezeTag: null` on dev runs.

The freeze record (`study-config.json`) stores the model id, temperature, skill-prompt hash, base and C2 tool-schema hashes, DASR appendix hash, oracle protocol hash, gold-file hashes, git commit, and the C1/C2 flag state. The C2 tool schema differs from C1 by the DASR surface. That difference is the condition.

Dev runs may execute on a commit that does not match `exp-freeze-v1.2`. That mismatch is recorded. It does not make the run confirmatory.

## Analysis, once a frozen set exists

- Pair scenarios. Report the mean paired SCR difference and a 95% confidence interval (scenario-level bootstrap, or a logistic model with a scenario random effect if the sample supports it).
- Report the absolute and relative difference, the interval, task completion, and parse success. A p-value alone is not the result.
- C0 is not a secondary contrast in this plan, because it is not run. If a later protocol adds a fair tool-free C0, that addition needs its own freeze record and a pre-declared multiplicity adjustment (Holm) on the scenario unit. Do not add it after seeing C1/C2 outcomes.
- Do not add or drop scenarios after seeing confirmatory outcomes. Do not pool replications into the sample size.

## Stopping

Confirmatory collection starts only after dual annotation of the held-out set, a new tag cut after DASR has merged (proposed name `study-a-freeze-v0.1`, never `exp-freeze-v1.2`), the adjudicated gold hash, and this plan’s definitions are recorded. See `study-a/freeze-checklist.md`. It stops at the pre-declared scenario count and replication count (target 3 replications; 2 if that is all that will be run, stated in the freeze record). This stub does not start that collection. Draft-gold files must not be passed to a confirmatory command.

The development examples may be run as often as needed to test the harness. Those runs are not confirmatory data.
