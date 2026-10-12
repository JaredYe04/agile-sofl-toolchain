# Study A held-out annotation

Annotator A is **Xujun Ye**. Annotator B is **Jinlin Zhang**.

Xujun Ye labels in `annotator-a/` and returns `annotator-a.blank.csv`. Jinlin Zhang labels in `annotator-b/` and returns `annotator-b.blank.csv`.

The two folders contain the same scenario texts and the same empty judgment columns. The `annotator` cell is `A` or `B`.

## Work independently

Label every scenario in `blind/` inside your annotator folder. Finish the full sheet before any judgment is discussed.

Until both sheets are locked:

- Leave the other annotator's sheet, notes, and messages about a label unread.
- Leave model outputs unread. That includes metrics, event logs, run manifests, transcripts, and score tables.
- Do not run a model or an agent on these scenarios.
- Label from the requirements, the informal specification, and the candidate slot prompts in `blind/`. A prompt names a decision. It does not state an answer.
- Scenario codes in this pack are `S01` through `S15`. Write those codes on the sheet. A coordinator crosswalk sits outside this folder. Leave that crosswalk unread.

When the sheet is locked, stop editing and hand the file to the person who will compare the pair. A wrong code may be corrected after lock. Describe that correction in `notes` as a clerical fix, with the old code and the new code.

## What to label

The sheet has one scenario row for each code `S01`–`S15`, plus one row for each candidate slot listed under that code. The key is `scenario_id` + `slot_id`.

- A scenario row has an empty `slot_id` and `row_type` `scenario`.
- A slot row has the prompt's slot id and `row_type` `slot`.

Judgment cells start empty. Fill them on this sheet. To propose a slot that is not listed, add a row: copy `scenario_id`, set `row_type` to `slot`, and choose a new `slot_id` that does not match a listed slot id. Leave the listed rows in place.

| Column | Row | What you write |
| --- | --- | --- |
| `annotator` | both | Already `A` or `B`. |
| `scenario_id` | both | Already `S01`–`S15`. |
| `slot_id` | slot | Already the listed slot id. Empty on a scenario row. |
| `row_type` | both | Already `scenario` or `slot`. |
| `kind` | scenario | `underspecified`, `clear-control`, or `maintenance`. |
| `keep_unit` | both | `yes` or `no`. On a scenario row: keep this scenario. On a slot row: this candidate is an unresolved business choice. |
| `interpretation_1` | slot | One operational business rule for this slot. |
| `interpretation_2` | slot | A second operational business rule for this slot. |
| `interpretations_meaningfully_different` | slot | `yes` or `no`, after both interpretations are written. |
| `invites_repeated_clarification` | scenario | `yes` or `no`. Used for the clear-control focus check. |
| `clarification_target` | slot | The information that would close the slot. |
| `must_not_confirm_element_ids` | slot | Element ids that must not be confirmed before the slot is answered. Separate several ids with semicolons. |
| `maintenance_affected_ids` | scenario | Ids the change should touch, separated by semicolons. Empty when `kind` is not `maintenance`. |
| `maintenance_unaffected_ids` | scenario | Ids that should stay as they are, separated by semicolons. Empty when `kind` is not `maintenance`. |
| `notes` | both | Short clerical notes. |

A field that contains a comma or a quotation mark must be wrapped in double quotes, and each inner quotation mark doubled. A spreadsheet editor does this on save.

Element ids use `proc:<Area>.<Name>`, `inv:<Area>.<Name>`, or `type:<Area>.<Name>`.

### Kind

- `underspecified` — a careful reader cannot settle at least one business choice from the source text alone.
- `clear-control` — the source states the rule, including the numbers, the cutoff, or the policy, and a second operational reading is left closed.
- `maintenance` — the task is an upstream change plus an impact judgment. Name the affected ids and the unaffected ids on the scenario row. An open business choice inside the change is still a slot.

## Focus checks

Apply these on the sheet before locking it.

**Unresolved slots.** Every slot kept with `keep_unit` `yes` needs at least two business interpretations. The two rules must change what the system does, charges, allows, or keeps. Write them in `interpretation_1` and `interpretation_2`. Set `interpretations_meaningfully_different` to `yes` only when both rules are written and they differ operationally. Two wordings of one rule fail this check. Set the cell to `no` when they do not differ. A slot with `keep_unit` `no`, or with this check `no`, is not an unresolved slot.

**Clear controls.** A clear control must not invite extra clarification. On the scenario row, set `invites_repeated_clarification` to `yes` when a careful reader would still ask a question that could change the stated rule, including a question that asks for a different number from the one the source states. Set it to `no` when the source leaves no such question. A scenario is a clear control only when `kind` is `clear-control`, `keep_unit` is `yes`, and `invites_repeated_clarification` is `no`.

## After both sheets are locked

Compare the sheets only after both full sheets are locked. When a scenario is still in disagreement after that comparison, leave it unresolved for adjudication. One annotator does not close that disagreement alone.
