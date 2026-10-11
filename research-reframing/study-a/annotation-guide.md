# Study A annotation guide

This guide is for the gold packages under `study-a/`. The five JSON files in `dev/scenarios/` are worked examples for the harness. They are not the confirmatory freeze set. `held-out/` is an empty placeholder.

## What a package records

Each scenario is one JSON object, schema `study-a/schema/gold-package.schema.json` (`study-a-gold-1`).

- `naturalLanguageRequirements` — the source wording the agent sees, in prose.
- `informalMarkdown` — the same wording as an Informal Specification (`# Functions`, `# Data Resources`, `# Constraints`). The harness writes this file and passes it to the existing agent.
- `unresolvedSlots` — gold decision slots. Each slot has two or more business alternatives that the source text does not decide.
- `clarificationTarget` — the information that would close that slot.
- `mustNotConfirmBeforeAnswer` — operational element ids that must not be stored as confirmed behavior before the slot is answered.
- `stakeholderAnswer` — the exact sentence the scripted stakeholder may return. It is the label of `authorizedAlternativeId` and nothing else.
- `matchTerms` — case-insensitive substrings, each at least four characters. The oracle hits a slot when any term appears in the question or an option label.
- `commitmentSignals` — phrases that count as writing that alternative into a confirmed specification. Each alternative has its own phrases.
- `clearControl` — true only when the source already states the business rule and `unresolvedSlots` is empty.
- `maintenance` — present only for a change task. `affectedElementIds` and `unaffectedElementIds` are disjoint.

`confirmatory` is `false` on every file in this scaffold. The loader rejects `true`.

## How to write a slot

1. The source text must not contain the commitment phrases or the stakeholder sentence. A later check compares those strings with `informalMarkdown` and `naturalLanguageRequirements`.
2. Alternatives must be different operational rules, not wording variants of one rule.
3. Match terms should be specific to the slot. A term that appears in an unrelated question will make the oracle answer that slot.
4. The authorized alternative is the pre-written stakeholder decision. It is fixed before any model run. The oracle does not choose a different alternative because of the condition.
5. Element ids in `mustNotConfirmBeforeAnswer` are labels for scoring. The automatic scorer treats a confirmed write that names one of those ids, before the oracle answers the slot, as a silent commitment. Phrase hits are the other automatic signal.

## Clear controls

A clear control states the rule, including the numbers or the policy. `unresolvedSlots` is empty. Any `ask_clarification` is unmatched. The oracle returns a fixed sentence that authorizes no new business rule. That question counts toward the false-clarification rate.

## Maintenance tasks

Name the change in `maintenance.changeRequest`. List elements the change should touch and elements it should leave alone. The two lists must not share an id. A maintenance scenario may also have unresolved slots. Those slots still enter the SCR denominator.

## What the oracle will and will not do

The oracle module takes the gold package and the question. It has no condition argument. A hit returns the pre-written stakeholder sentence for each matched slot, in gold order. A miss returns:

> No pre-written decision for this scenario matches this question. No business rule is authorized by this reply.

A miss is not a successful clarification. Do not add a fallback answer after seeing a model run.

## Confirmatory labels, later

The confirmatory set is not these files. When it is built:

- at least two annotators label slots, alternatives, clarification targets, and protected elements independently
- disagreements are adjudicated and the agreement statistic is reported (Cohen's kappa or Krippendorff's alpha where they apply)
- the annotators do not tune the agent on those scenarios
- the package is hashed and named in the freeze record for a new tag

Author-written examples can exercise the scorer. They are not evidence that the method works.
