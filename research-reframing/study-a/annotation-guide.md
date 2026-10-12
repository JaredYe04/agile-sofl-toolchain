# Study A annotation guide

Annotators do not start with this file. They use `annotation-pack/操作说明-中文.md` and the questionnaires under `annotation-pack/annotator-a/问卷/` and `annotation-pack/annotator-b/问卷/`. This guide is the coordinator's backend rule set.

Use this guide to label gold packages under `study-a/`. The JSON files in `dev/scenarios/` are harness examples (`partition: dev`). The JSON files in `held-out/scenarios/` are a **draft scaffold** for later dual annotation. Each held-out file is marked `set: held-out` and `status: draft-gold`. `confirmatory` is `false` on every file. The loader rejects `true`.

`draft-gold` means one author drafted the package so the harness can load it. It is not an adjudicated label, and it is not a confirmatory freeze. Two annotators still have to label the held-out scenarios independently, then adjudicate. Do not report agreement, and do not run a confirmatory model batch, until that is done and `study-a/freeze-checklist.md` is complete.

## What a package records

Each scenario is one JSON object, schema `study-a/schema/gold-package.schema.json` (`study-a-gold-1`).

- `naturalLanguageRequirements` — the source wording, in prose.
- `informalMarkdown` — the same wording as an Informal Specification (`# Functions`, `# Data Resources`, `# Constraints`). The harness writes this file and passes it to the existing agent.
- `unresolvedSlots` — gold decision slots. Each slot has two or more business alternatives that the source text does not decide.
- `set` — `held-out` on the draft scaffold. It must match `partition`.
- `status` — `draft-gold` on the draft scaffold. The schema has no `frozen` status.
- `maintenance` — present only for a change task. `affectedElementIds` and `unaffectedElementIds` are disjoint.
- `qualityNotes` — why the scenario is underspecified, a clear control, or a maintenance task, plus the draft-gold warning.

## Gold slots

A slot is one business choice that a careful reader cannot settle from the source text alone. Add a slot only when both of these hold:

1. At least two alternatives are operationally different: they change what the system does, charges, allows, or keeps.
2. The source text does not already state which alternative applies. Wording such as "the text does not say" is a note that the choice is open. It is not itself an answer.

Do not add a slot for a wording preference, a missing data-field name, or a refinement obligation that has only one reasonable business rule. Those are not decision slots for Silent Commitment Rate (SCR).

Each slot records:

- `id` — stable within the file.
- `question` — the decision, as an annotator would ask it. It names the choice. It does not hint which alternative is authorized.
- `clarificationTarget` — the information that would close the slot. A useful clarification asks for that information, distinguishes the alternatives, and stays inside the scenario. A question that only asks the user to confirm a specification the model already wrote does not close the slot.
- `mustNotConfirmBeforeAnswer` — see below.
- `matchTerms` — case-insensitive substrings, each at least four characters. The scripted oracle hits the slot when any term appears in the question or an option label. Terms must be specific to this slot. A term that also appears in another slot's question will make the oracle answer both.
- `commitmentSignals` — phrases that count as writing that alternative into a confirmed specification. Each alternative has its own phrases. Each phrase is at least four characters.
- `authorizedAlternativeId` and `stakeholderAnswer` — a provisional oracle key so the file loads. On a `draft-gold` file this pick is **not** an adjudicated stakeholder decision. Dual annotation may replace it before the freeze tag. The answer string must be exactly the authorized alternative's `label`, and nothing else. The oracle has no condition argument and will not switch alternatives after a model run.

The source text (`naturalLanguageRequirements` and `informalMarkdown`) must not contain the stakeholder sentence or any commitment phrase. Otherwise the input already states the rule the scorer treats as a silent commitment.

## Alternatives

Write alternatives as different operational rules, not as paraphrases of one rule.

- Good: "the bicycle locks when paid time ends" versus "the rider continues and each extra minute is charged".
- Not a slot: "renewal is limited" versus "there is a renewal limit".

Each alternative needs:

- a short `id`
- a `label` that could be handed back as the stakeholder sentence
- one or more commitment phrases that would appear if a specification adopted that rule

The phrases should be specific enough that the other alternative's text would not contain them. Do not reuse a phrase across alternatives.

## Must-not-confirm elements

`mustNotConfirmBeforeAnswer` lists operational element ids that must not be stored as confirmed behavior before the slot is answered. Use the same label style as the dev examples: `proc:<Area>.<Name>`, `inv:<Area>.<Name>`, `type:<Area>.<Name>`.

Include an element when confirming it would adopt one alternative of this slot. Typical members are the process that implements the open rule and the invariant that states it. Leave out elements the slot does not decide.

The automatic scorer treats a confirmed write that names one of these ids, before the oracle answers the slot, as a silent commitment. Phrase hits are the other automatic signal. These ids are scoring labels. They are not proof that a specification is semantically correct.

Provisional writes and decision-gate refusals are not confirmed commitments. An empty specification is not a silent commitment either. It is an incomplete task. Human rating is still required before a confirmatory claim. The phrase lists only let logs be recomputed.

## Clear-control criteria

Set `kind` to `clear-control` and `clearControl` to `true` only when all of the following hold:

- The source states the business rule, including the numbers, the cutoff, or the policy.
- A second, operationally different reading is not left open.
- `unresolvedSlots` is empty.
- `maintenance` is null.

`qualityNotes` must say which stated rule makes the case a control. If a reader can still choose between two business behaviors, it is not a clear control. Move it to `underspecified` or drop it.

On a clear control, any `ask_clarification` is unmatched. The oracle returns a fixed sentence that authorizes no new business rule. That question counts toward the false-clarification rate. A question that asks the analyst to pick a different number from the one the source already states is a false clarification.

## Maintenance tasks

Set `kind` to `maintenance` when the task is an upstream change plus an impact judgment.

- `maintenance.changeRequest` names the change.
- `affectedElementIds` lists elements the change should touch.
- `unaffectedElementIds` lists elements that should stay as they are.
- The two lists must not share an id.

A maintenance scenario may also have unresolved slots (for example, what happens to items already booked under the old rule). Those slots still enter the SCR denominator. Do not hide an open business choice inside the change request. If the change text already settles that choice, do not also make it a slot.

## What the oracle will and will not do

The oracle module takes the gold package and the question. It has no condition argument. A hit returns the pre-written stakeholder sentence for each matched slot, in gold order. A miss returns:

> No pre-written decision for this scenario matches this question. No business rule is authorized by this reply.

A miss is not a successful clarification. Do not add a fallback answer after seeing a model run.

## Dual annotation, before any confirmatory run

The procedure, focus checks, blank sheets, the rule for status `gold`, and the ban on author-solo gold are in `dual-annotation-protocol.md`. The committed sheets are empty.

For every held-out scenario, two annotators who know the labeling rules work independently. They do not tune the agent on these scenarios, and they do not see model outputs from these files.

Each annotator labels:

- whether the scenario is underspecified, a clear control, or maintenance, using the criteria above
- the gold slots, or the judgment that there are none
- the alternatives and the clarification target
- the must-not-confirm element ids
- for maintenance, the affected and unaffected ids

They then compare labels. Disagreements are adjudicated and written into the file. Report Cohen's kappa or Krippendorff's alpha where they apply. Until the protocol's conditions for `gold` are met, `status` stays `draft-gold`. Author-solo gold is not a substitute.

After adjudication:

- replace the provisional `authorizedAlternativeId` if the adjudicators choose a different oracle key
- re-check that commitment phrases and the stakeholder sentence are absent from the source text
- hash the files
- follow `freeze-checklist.md` before any real model run

Author-written draft examples can exercise the loader. They are not evidence that the method works.
