# Study A dual-annotation protocol

Annotators do not start with this file. The human entry is `annotation-pack/操作说明-中文.md`, copied into each annotator folder, and the Chinese questionnaires in `annotation-pack/annotator-a/问卷/` and `annotation-pack/annotator-b/问卷/`. `annotation-pack/README-OPEN.md` only points at that entry. The blank CSV in each annotator folder is a backend backup. After both questionnaires are locked, the coordinator may transcribe answers into the matching CSV columns. This English file stays the coordinator's reference.

This file is the procedure for labeling the held-out scaffold. It adds no labels, no agreement statistic, and no Silent Commitment Rate (SCR). The sheets in `annotation-sheets/` are blank templates. Their filled cells in this commit are the row keys only.

The draft packages under `held-out/scenarios/` stay `status: draft-gold`. Labeling rules for slots, alternatives, must-not-confirm elements, clear controls, and maintenance tasks are in `annotation-guide.md`. This protocol says how two people apply that guide, and when a later change may mark status `gold`.

## Two annotators

Two independent annotators label every held-out scenario.

- Annotator A is Xujun Ye.
- Annotator B is Jinlin Zhang.

The person who drafted the JSON may be one of the two annotators. That person is one vote. A second annotator is still required. One person cannot complete both sheets.

## Kickoff pack

The folders to send are the blind folders under `annotation-pack/`. Annotators open `操作说明-中文.md` in their own folder and fill `问卷/S01.md` through `问卷/S15.md`. They do not fill the CSV.

- Xujun Ye receives `annotation-pack/annotator-a/` only.
- Jinlin Zhang receives `annotation-pack/annotator-b/` only.

Each folder contains the same blind texts, the same Chinese questionnaires, and a blank sheet kept as a backup. The texts are the natural-language requirements, the informal specification, and the slot questions. They leave out `kind`, `clearControl`, `qualityNotes`, `alternatives`, `authorizedAlternativeId`, `stakeholderAnswer`, `matchTerms`, `commitmentSignals`, `mustNotConfirmBeforeAnswer`, and the maintenance id lists. Sheet rows use opaque scenario codes `S01`–`S15`. The `annotator` cell is `A` or `B`. Judgment cells are empty.

`annotation-pack/id-map.sealed.json` maps those codes to the held-out file ids. Annotators must not receive that file or `held-out/scenarios/`. After both sheets are locked, join `scenario_id` on the sheet back to the draft scenario id with that map. Slot ids are unchanged.

`annotation-sheets/annotator-a.blank.csv` and `annotation-sheets/annotator-b.blank.csv` keep the real scenario ids for the coordinator. They are the unblinded key template. They are not the sheets to send. Their judgment cells stay empty.

Every held-out file stays `status: draft-gold` until both kickoff sheets are locked and adjudication under this protocol has finished. This pack does not run a model, does not report SCR, and does not cut a freeze tag.

## No peeking

Work separately until both sheets are locked (see below).

During independent labeling, the allowed materials are:

- the scenario source: `naturalLanguageRequirements` and `informalMarkdown`
- the sheet row's `scenario_id` and `slot_id`
- on a slot row, that slot's `question` in the draft JSON

The `question` names the candidate decision. It is the unit being labeled. It is not an answer.

The Chinese questionnaire in the kickoff folder restates those materials and the empty column definitions. Filling it is the annotator entry. It is not an answer key. The kickoff folder already contains those materials and nothing else from the draft file. Leave the draft JSON closed.

Leave these draft fields unread while labeling. They are the author's provisional oracle key and the author's notes:

- `kind`, `clearControl`, `qualityNotes`
- `alternatives`, `authorizedAlternativeId`, `stakeholderAnswer`
- `matchTerms`, `commitmentSignals`, `mustNotConfirmBeforeAnswer`
- `maintenance.affectedElementIds`, `maintenance.unaffectedElementIds`

Do not open the other annotator's sheet, notes, or messages about a label. Do not talk about a judgment before both full sheets are locked.

Do not open model outputs for these scenarios. That includes `metrics.json`, `study-events.jsonl`, run manifests, blinded artifacts, transcripts, oracle replies from a model call, and any SCR table. Do not run the agent on held-out files. Do not pass `--confirmatory`. Do not tune prompts, tools, or the agent on these scenarios.

A harness `--list` of `held-out/` prints id, set, status, kind, and domain. It does not call a model. It is not an annotation input. Annotators label kind from the source text, not from that listing.

## Sheet keys and columns

Each sheet has 28 rows: one scenario row for each of the 15 held-out files, plus one row for each of the 13 draft slots already in those files (the pharmacy scenario has two slots). Those counts are the scaffold inventory. They are not agreement and they are not a result.

The key is `scenario_id` + `slot_id`.

- A scenario row has an empty `slot_id` and `row_type` `scenario`.
- A slot row has the draft slot id and `row_type` `slot`.

`row_type` distinguishes those two keys. It is not a judgment.

Judgment columns ship empty. Leave them empty in git until a human annotator fills a private copy. Do not invent values for a demo, a test, or a placeholder SCR.

| Column | Row | What the annotator writes |
| --- | --- | --- |
| `annotator` | both | Already `A` or `B`. |
| `scenario_id` | both | Already the draft scenario id. |
| `slot_id` | slot | Already the draft slot id. Empty on a scenario row. |
| `row_type` | both | Already `scenario` or `slot`. |
| `kind` | scenario | `underspecified`, `clear-control`, or `maintenance`, from `annotation-guide.md`. |
| `keep_unit` | both | `yes` or `no`. On a scenario row: keep this scenario in the held-out set. On a slot row: this candidate is an unresolved business choice. |
| `interpretation_1` | slot | One operational business rule for this slot. |
| `interpretation_2` | slot | A second operational business rule for this slot. |
| `interpretations_meaningfully_different` | slot | `yes` or `no`, after both interpretations are written. |
| `invites_repeated_clarification` | scenario | `yes` or `no`. Used for the clear-control focus check. |
| `clarification_target` | slot | The information that would close the slot. |
| `must_not_confirm_element_ids` | slot | Element ids that must not be confirmed before the slot is answered. Several ids go in one cell, separated by semicolons. |
| `maintenance_affected_ids` | scenario | Ids the change should touch, separated by semicolons. Empty when `kind` is not `maintenance`. |
| `maintenance_unaffected_ids` | scenario | Ids that should stay as they are, separated by semicolons. Empty when `kind` is not `maintenance`. |
| `notes` | both | Short clerical notes. Not a second sheet of labels. |

A field that contains a comma or a quotation mark must be wrapped in double quotes, and each inner quotation mark doubled. Spreadsheet editors do this on save.

To propose a slot the draft does not list, add a row on your own sheet. Copy `scenario_id`, set `row_type` to `slot`, and choose a new `slot_id` that does not match a draft slot id. Leave the template's existing rows in place. The other annotator will not see that extra row until lock.

## Focus checks

Fill these only on a private copy of the sheet. This repository copy stays blank. This file does not mark any scenario pass or fail.

### Unresolved slots

Every unresolved slot has at least two meaningfully different business interpretations. The two rules must change what the system does, charges, allows, or keeps. Two wordings of one rule fail the check.

Write the two rules in `interpretation_1` and `interpretation_2`. Then set `interpretations_meaningfully_different`. Set that cell to `yes` only when both rules are written and they differ operationally. Set it to `no` when they do not. A slot with `keep_unit` `no`, or with this check `no`, is not an unresolved slot in the resolved package.

### Clear controls

A clear control must not invite repeated clarification. The source states the rule, including the numbers, the cutoff, or the policy. A second operational reading is not left open. `unresolvedSlots` is empty. `maintenance` is null. See `annotation-guide.md`.

On the scenario row, set `invites_repeated_clarification`. Set it to `yes` when a careful reader would still ask a question that could change the stated rule, including a question that asks for a different number from the one the source states. That value fails the clear-control check. Set it to `no` when the source leaves no such question. A scenario can be a clear control only when `kind` is `clear-control`, `keep_unit` is `yes`, and `invites_repeated_clarification` is `no`.

## Lock

A sheet is locked when the annotator stops editing and hands the file to the person who will compare the pair. After lock, judgments stay as submitted. A wrong key may be corrected. Describe that correction in `notes` as a clerical fix, with the old key and the new key.

Lock both full sheets before any comparison. Locking one scenario early lets later rows follow the other person.

## Disagreement resolution

Compare on the key `scenario_id` + `slot_id` after both sheets are locked. An empty `slot_id` is the scenario row. Extra rows one person added are disagreements until the other person has labeled that proposed slot on a fresh locked pass, or the proposal is dropped.

Categorical cells (`kind`, `keep_unit`, `interpretations_meaningfully_different`, `invites_repeated_clarification`) match when the trimmed values are equal, ignoring case. Id-list cells match when the semicolon-separated ids are the same set. Free-text cells (`interpretation_1`, `interpretation_2`, `clarification_target`, `notes`) are compared as operational rules, not as raw strings. The two annotators mark each pair as the same rule or as different rules.

When the applicable cells match, accept them.

When they differ, both annotators meet with both locked sheets and the source text. Model outputs stay closed. They record, outside these blank templates, the field, both values, the resolved value, and a one-line reason. Equivalent operational rules may be accepted as one rule, with the reason stating that. Two rules that change what the system does, charges, allows, or keeps stay a disagreement until one resolved value is chosen or the unit is dropped.

If they still disagree, that scenario stays `draft-gold`. There is no coin flip and no solo vote by the draft author. Status for the held-out set cannot become `gold` while any scenario is unresolved.

A failed focus check drops or repairs that unit before gold. A repair changes the source or the slot list, then both annotators label the repaired scenario again on new sheets. The failed sheets stay as the record of that pass. They are not edited into the new pass.

Report Cohen's kappa for two annotators, or Krippendorff's alpha, on the categorical codes. For free text, the statistic uses the equivalence code (same rule or different rules), not the raw string. If a coefficient is undefined because a code does not vary, record that it is undefined and why. Do not replace an undefined coefficient with a perfect score. This commit does not compute a coefficient.

## When status may become `gold`

Status may become `gold` only when every item below is true:

1. Annotator A and Annotator B have each locked a full sheet, filled without reading each other or any model output.
2. Every kept unresolved slot has two meaningfully different business interpretations on the resolved label (`interpretations_meaningfully_different` is `yes`).
3. Every kept clear control does not invite repeated clarification (`invites_repeated_clarification` is `no`).
4. Disagreements are resolved under the section above, and none remain open.
5. The agreement statistic is reported with the adjudication record, including any coefficient that is undefined.
6. The resolved labels, including a confirmed or replaced oracle key, are written into the scenario files by that adjudication. The stakeholder sentence and the commitment phrases stay out of the source text.
7. The schema and the loader accept the value `gold`. Under `study-a-gold-1` they do not. Held-out files are valid only with `status: draft-gold`. A later change has to admit `gold` before any file may carry it.

Until those items are true, every held-out file stays `draft-gold`. This commit does not change a status field, does not change the schema, and does not write `gold` into any scenario.

`gold` is an adjudicated human label. It is not a freeze tag and not a model score. `confirmatory` stays `false`. The loader rejects `true`.

## Author-solo gold is forbidden for confirmatory SCR

The draft author must not set `gold` alone. One annotator must not set `gold` alone. A label that has only one person's sheet behind it is not `gold`, even if that person wrote the scaffold.

Confirmatory SCR may be computed only from a run on the freeze tag below, after status is `gold` under this protocol. SCR from `draft-gold` files, from one sheet, or from the author alone is not confirmatory SCR and must not be reported as Study A confirmation. This commit reports no SCR and does not run a model.

## When `study-a-freeze-v0.1` may be cut

The tag `study-a-freeze-v0.1` may be cut only when all of the following hold on the commit the tag will name:

- Every held-out package on that commit has status `gold` under the section above.
- The resolved gold, the agreement report, and the adjudication record are in that commit.
- DASR has merged, and the tag points at that merged history. `HEAD` equals the tagged commit.
- `analysis-plan.md` on that commit still uses the scenario as the sampling unit and still leaves C0 unrun.
- `freeze-checklist.md` is complete, including the harness freeze-config record copied at tag time. Those hash and model cells stay blank until then.

`exp-freeze-v1.2` cannot be the confirmatory tag. Cutting `study-a-freeze-v0.1` is a human step. This commit does not create the tag.

Dual annotation is a hard gate in front of that tag. The gate is also stated in `freeze-checklist.md`.

## What this commit leaves undone

No annotator has filled a sheet. No disagreement has been resolved. No kappa or alpha has been computed. No scenario status has changed. No freeze tag has been cut. No confirmatory command has been run.
