# Study A freeze checklist

This checklist is the gate in front of a confirmatory Study A run. The files in `held-out/scenarios/` do **not** pass it. They are `status: draft-gold`: a scaffold for human dual annotation. No confirmatory result exists, and this document does not record one.

**Hard gate.** Dual annotation is a hard gate before freeze. Follow `dual-annotation-protocol.md`. Annotator A is Xujun Ye. Annotator B is Jinlin Zhang. The folders to send are `annotation-pack/annotator-a/` and `annotation-pack/annotator-b/`. The human entry inside them is `操作说明-中文.md` and `问卷/`. The blank CSV there is a backup for transcription, not the annotator entry. The blank sheets in `annotation-sheets/` (`annotator-a.blank.csv`, `annotator-b.blank.csv`) carry the real scenario id and slot id keys only. Their judgment cells are empty. They are not labels, agreement, or SCR, and they are not the sheets to send. Do not cut `study-a-freeze-v0.1` until that protocol allows status `gold`. Author-solo gold does not open this gate. Status stays `draft-gold` until both kickoff sheets are locked and adjudication has finished.

Do not start a real model batch, and do not pass `--confirmatory`, until every item below is done. A dry `--list` of the scaffold is allowed. It does not call a model and does not freeze anything.

## 1. Dual annotation before any real run

- [ ] Two annotators have labeled every held-out scenario independently, using `annotation-guide.md`.
- [ ] Slots, alternatives, clarification targets, must-not-confirm elements, and maintenance impact sets were adjudicated.
- [ ] Agreement is reported (Cohen's kappa or Krippendorff's alpha where they apply).
- [ ] `status` stays `draft-gold` until `dual-annotation-protocol.md` allows `gold`. Do not set `confirmatory` to `true` (the loader rejects it). Author-solo gold is forbidden.
- [ ] Annotators did not tune prompts, tools, or the agent on these scenarios, and did not see model outputs from them.
- [ ] The source text of each scenario does not contain that scenario's stakeholder sentence or commitment phrases.

The provisional `authorizedAlternativeId` in a draft file is an oracle key so the JSON loads. It is not an adjudicated decision until the annotators confirm or replace it.

## 2. New git tag after DASR has merged

Confirmatory runs require a **new git tag cut after DASR has merged**. Proposed name:

`study-a-freeze-v0.1`

That tag must point at the commit that will actually be executed. `HEAD` must equal the tagged commit. The harness checks this when `--confirmatory --freeze-tag` is set.

**Forbidden as the confirmatory tag:** `exp-freeze-v1.2`.

`exp-freeze-v1.2` is the pre-DASR pilot freeze. The Study A command refuses it in confirmatory mode. Do not reuse it, do not move it, and do not describe a run on that tag as Study A confirmation. Dev runs may record that the pilot tag does not match `HEAD`. That mismatch does not make the run confirmatory.

Cut the new tag only after:

- [ ] The dual-annotation hard gate has passed under `dual-annotation-protocol.md`: two locked independent sheets, focus checks, disagreement resolution, and status `gold` only by that protocol. Author-solo gold does not count.
- [ ] The DASR decision records, impact links, and decision-aware gate are on the merged commit the tag names.
- [ ] The adjudicated held-out gold is in that same commit.
- [ ] `analysis-plan.md` on that commit still treats the scenario as the sampling unit and still leaves C0 unrun.

Creating `study-a-freeze-v0.1` is a human step. This scaffold does not create the tag.

## 3. Record the harness freeze config

On the tagged commit, record the freeze config the harness writes (`study-config.json` from `buildStudyAConfig` in `packages/studio/scripts/agent-harness/studyAConfig.ts`). Copy the values from that file. Do not invent hashes, model ids, or temperatures.

Fill this record at tag time:

| Field | Where it comes from | Value at freeze |
| --- | --- | --- |
| `confirmatoryFreezeTag` | must be `study-a-freeze-v0.1` (or the name actually cut). Never `exp-freeze-v1.2`. | |
| `gitCommit` | `HEAD`, equal to the tagged commit | |
| `configuredModelId` | `ECNU_MODEL`, otherwise the harness fallback `ecnu-max` | |
| `temperature` | `0.35` (`PILOT_TEMPERATURE` in `core.ts`, sent by `agentLoop.ts`) | |
| `temperatureSource` | the `temperatureSource` string in the config | |
| `hashes.skillPromptSha256` | skill prompt for `hybrid-generation` | |
| `hashes.userTextSha256` | the frozen Study A user text | |
| `hashes.baseToolSchemaSha256` | base tool schema | |
| `hashes.c1ToolSchemaSha256` | tools with DASR off | |
| `hashes.c2ToolSchemaSha256` | tools with DASR on | |
| `hashes.dasrAppendixSha256` | DASR prompt appendix | |
| `hashes.unmatchedOracleReplySha256` | fixed non-answer for a question that hits no slot | |
| `hashes.oracleProtocol` | oracle protocol id | |
| `hashes.goldSchemaVersion` | `study-a-gold-1` unless the schema version was intentionally bumped before the tag | |
| `harnessSha256` | harness directory hash | |
| `goldSchemaSha256` | `study-a/schema/gold-package.schema.json` | |
| per-scenario `goldSha256` | key file, one hash per adjudicated scenario | |

Also record: condition list (`C1`, `C2` only), replication count (target 3; 2 only if the freeze record says so), `maxApprovals`, and the seed once the run starts. The C2 tool schema differs from C1 by the DASR surface. That difference is the condition, not drift.

`confirmatoryFreezeTag` stays `null` on every run taken before the new tag, including any dry run of this scaffold.

## 4. C0 is not run

- [ ] The command conditions are `C1,C2` only.
- [ ] C0 stays secondary and is not executed. The harness refuses `--conditions` that include `C0`.
- [ ] No table, abstract, or note reports an SCR for C0.

C1 is the existing agent with `AGILE_SOFL_DASR=0`. C2 is the same agent with `AGILE_SOFL_DASR=1`. The primary outcome is the paired difference `SCR(C2) − SCR(C1)` with the scenario as the sampling unit. See `../analysis-plan.md`.

## 5. What still blocks a confirmatory command

Until the boxes above are checked, the allowed harness use of `held-out/` is:

```bash
node .harness/study-a.mjs --list ../../research-reframing/study-a/held-out
```

That prints scenario id, set, status, kind, and domain. It does not call a model.

A confirmatory invocation, only after this checklist is complete, looks like:

```bash
node .harness/study-a.mjs --confirmatory --freeze-tag study-a-freeze-v0.1 --allow-held-out --scenario <adjudicated.json> --conditions C1,C2
```

The command refuses `exp-freeze-v1.2`, refuses a tag that is not `HEAD`, and refuses every DEV scenario. Draft-gold files are the wrong input for that command until adjudication replaces them and the tag exists.
