# Study B simulated-analyst protocol

Protocol id: `study-b-sim-1`.

This document specifies a procedure. It records no runs and no measured outcomes. Counts, rates, and quality scores, if they are collected later, belong in a separate results file that cites `study-b-sim-1` and repeats the claim boundary in section 2. This file must stay free of those numbers.

The procedure is the fallback used when human analysts cannot be recruited for the paired comparison of the base editor and full Decision-Aware Specification Refinement (DASR, condition C2). Every operator defined here is a **simulated analyst**. A simulated analyst is a configured role agent that drives Agile-SOFL Studio. It is a stand-in for process measurement only.

The human paired study in the refactor plan (manual editing versus full DASR, with human task time and human questionnaires) remains a separate design. This protocol does not change that design, does not lower its sample, and does not supply its outcomes.

## 1. Hard rules

1. Every role agent in this protocol is a simulated analyst.
2. Paper text, captions, tables, and talk slides that report these runs write **simulated analysts**. The words participant, subject, and human study do not name these runs.
3. A simulated analyst does not serve as Annotator A or Annotator B for Study A gold labels.
4. A simulated analyst does not produce confirmatory gold: not Study A gold, and not the frozen Study B references used to score artifacts.
5. Simulated analysts operate the Studio agent, or the base editor, only as stand-ins when humans cannot be recruited.
6. Logs from this protocol stay in the Study B simulation archive. They are not joined to Study A scenario rows.

`confirmedBy` and any other actor field stores the role id (`sim:junior-se`, `sim:mid-re`, or `sim:senior-fm`). It does not store a personal name.

## 2. Locked claim boundary

### 2.1 Allowed reports

These runs may support only the following three reports. Each report is labelled preliminary simulation evidence.

| Report | What may be stated | Prerequisite |
| --- | --- | --- |
| Process completability | How many simulated-analyst sessions met the task deliverable checklist, and how many stopped for budget, tool error, or a protocol violation. The denominator is every session that started. | Session logs under section 7. |
| Interaction counts | Simulator turns and tokens; specification-agent turns and tokens on C2; clarification counts; apply and reject counts; editor-operation counts; decision confirm and reject counts. | The same logs. Counts stay counts. |
| Artifact quality versus frozen gold | Blind human scores of the stopped artifacts against a frozen Study B reference (E1–E6 under the frozen rubric, coverage as full / partial / absent, parser and type well-formedness). | The reference was frozen by humans before the run, and human reviewers scored the blinded artifacts under section 8. |

A table of interaction counts for the manual arm and the C2 arm may be published. The caption describes the table as interaction counts for simulated analysts.

### 2.2 Forbidden claims

The following claims are out of scope for every result that comes from simulated analysts:

- Human time savings, minutes saved, or any statement that analysts finished sooner.
- SUS, or any other usability score.
- Workload, including NASA-TLX and any trust or effort questionnaire.
- Naming the work a human study, a user study, or a study of participants or subjects.
- Answering RQ3. RQ3 asks whether the full method reduces analyst effort for human analysts without degrading specification quality. Simulation logs do not answer it.

Wall-clock timestamps may be stored for audit order. They are not analyst time and they are not converted into a duration claim.

### 2.3 When the evidence is only process feasibility

If the logs show that sessions ran and artifacts were produced, and human blind review against frozen gold is missing, the only permitted statement is process feasibility: sessions reached a recorded stop reason.

That statement is marked **preliminary**. It stays under a heading of the form “Preliminary process feasibility (simulated analysts)”. It is not moved under an RQ3 heading, and it is not cited as support for an effort claim.

Artifact-quality sentences wait until section 8 has been carried out. Interaction counts may be reported before that review, still as preliminary simulation evidence, and still inside the boundary in section 2.2.

## 3. Arms

Each simulated-analyst instance completes both arms. The arms are the Study B pair. Study A conditions C0 and C1 are not arms of this protocol.

| Arm id | What the instance may use |
| --- | --- |
| `manual` | The base editor only: Informal, Hybrid, and GUI edits, plus the diagnostics the editor already shows. The specification agent is not started. DASR tools are not available. Write mode `auto` is off. |
| `C2` | Full DASR: decision records, impact links, the decision-aware gate, and the audit trail, with the specification agent proposing writes. Write mode is `ask`. The simulated analyst is the only Apply / Reject authority. |

The existing harness behaviour that auto-approves proposals and answers every clarification with a canned “best judgement” string is outside this protocol. A session that uses that behaviour is `protocol_stopped` and is reported in the denominator.

C2 starts from an empty decision ledger, or from the ledger the task packet explicitly includes. An empty ledger means no decisions are registered. It does not mean the requirements contain no unresolved decisions.

## 4. Role cards

Three role cards are defined. A new card requires a new protocol id. The blank schema is `research-reframing/study-b/role-card.schema.json`. Filling a card does not create a human analyst and does not authorize gold labels.

Shared training, identical for every card and both arms: the frozen Agile-SOFL / FSF training packet for Study B. Tool instructions differ by arm and are part of the frozen packet. The packet contains no gold answers, no Study A labels, and no Study B reference specification.

Shared invention rule: a business fact may enter a specification only when the task packet states it or the stakeholder script has already returned it in this session (section 6.2). Role skill licenses technical form. It does not license a missing stakeholder choice.

Shared prohibitions, every card:

- Serve as Annotator A or Annotator B.
- Write or edit confirmatory gold or a Study B reference.
- Read Study A held-out labels, Study A oracle keys, or Study B reference specifications.
- Treat a clear refinement digest as stakeholder confirmation.
- Treat parser success or an SMT result as stakeholder intent.
- Confirm a decision by engineering preference.
- Emit SUS, workload, or human-time judgements.

### 4.1 Junior software engineer — `sim:junior-se`

Skill claim: the shared training packet and general programming. The role can follow a worked example in the packet and can apply a syntax repair that an editor diagnostic names.

May supply:

- Informal structure that follows headings and sentences already in the task statement.
- Identifiers consistent with the training packet.
- A reject, when a proposal cannot be traced to a sentence in the task packet or to an authorized answer.

Must not invent:

- A business rule, an exception policy, or a data item the task does not name.
- A formal predicate that adds a constraint.
- A choice among open interpretations.
- A gold label or a fault score.

### 4.2 Mid-level requirements analyst — `sim:mid-re`

Skill claim: the shared training packet and ordinary requirements structuring (functions, data resources, constraints, and a trace from a stated sentence to an element).

May supply:

- An Informal inventory whose titles and descriptions paraphrase the task statement and add no obligation.
- A clarification question whose options are interpretations already written in the task packet, or already returned by the stakeholder script.
- Acceptance of an impact link whose element the task packet names.
- A needs-review mark when the task packet itself says the source requirement changed.

Must not invent:

- A missing business decision or a stakeholder preference.
- Extra functions that a similar system often has.
- Study A slots, gold labels, or E1–E6 scores.

### 4.3 Senior formal methods — `sim:senior-fm`

Skill claim: the shared training packet and transcription into SOFL modules, processes, CDFD structure, and pre/post or FSF.

May supply:

- A formal transcription of a rule that the task packet or an authorized answer already states in natural language.
- Use of parser, type, CDFD, and refinement-digest diagnostics as checks on form.
- A refusal to declare a process atomic while a structural or grain gate is still open.

Must not invent:

- An invariant, a scenario, or an operation that the authorized text does not state.
- A decision closure performed by writing a predicate.
- A reading of parser or SMT success as confirmation of stakeholder intent.

## 5. Task pairing and counterbalance

### 5.1 Pairing

One simulated-analyst instance is one filled role card plus one assigned cell. The instance runs two sessions:

- one session on arm `manual`;
- one session on arm `C2`;
- on two different task variants.

The two variants are a matched pair from the Study B pool. The instance never sees the same variant under both arms. The instance does not see the other arm’s artifact.

### 5.2 Counterbalance

Assignment is drawn before any session from a seed stored in the key file. The four cells are:

| Cell | Session 1 | Session 2 |
| --- | --- | --- |
| `MB-a` | `manual`, variant A of the pair | `C2`, variant B of the pair |
| `BM-b` | `C2`, variant B of the pair | `manual`, variant A of the pair |
| `MB-b` | `manual`, variant B of the pair | `C2`, variant A of the pair |
| `BM-a` | `C2`, variant A of the pair | `manual`, variant B of the pair |

Each role card contributes instances to all four cells before any role-to-role comparison of counts is written. A role that is missing a cell is reported as an incomplete role template, and role contrasts for that template are omitted. Instances are replicates of a prompt. The results file states the number of simulated-analyst instances. It does not present that number as a sample of people.

### 5.3 Disjoint from Study A

The Study B pool is taken from tasks that are absent from both of these frozen lists:

- the Study A held-out confirmatory manifest (hard exclusion);
- the Study A development and tuning manifest (also excluded, so construction cases are not reused).

A task is excluded when any of the following match a Study A id: the scenario id, the source-document hash, or a near-duplicate of the requirement text under the similarity rule frozen in the analysis plan. This protocol does not list scenario ids and does not define the tasks.

No session starts until all three manifests exist, are hashed, and the Study B ids have been checked against the two Study A lists:

- Study A held-out confirmatory manifest;
- Study A development manifest;
- Study B task-pool manifest.

The check is repeated when any manifest hash changes. A failed check invalidates the assignment.

### 5.4 Stop rule

Each task packet freezes a deliverable checklist and two budgets: a simulator turn budget, and a token budget. C2 also freezes a specification-agent turn budget. Training turns are outside the budget. The budget starts at the first editor operation or the first specification-agent call of the scored session.

A session has exactly one process outcome:

| Outcome | Assignment |
| --- | --- |
| `deliverable_stopped` | The checklist holds and the simulated analyst issued the stop action inside budget. |
| `budget_stopped` | A turn budget or a token budget was exhausted while the checklist was open. |
| `error_stopped` | A tool or gate failure ended the session under the pre-registered abort rule. |
| `protocol_stopped` | The session broke the apply / reject policy, the invention rule, the arm separation, or the gold-separation checklist. |

Every started session stays in the completability denominator, including `budget_stopped` and `error_stopped`. Outcomes are process outcomes for simulated analysts.

## 6. How simulated analysts drive Studio

### 6.1 Authority split on C2

The specification agent may call `propose_*`, `ask_clarification`, `list_decisions`, and `register_decision`. It may name `impactElementIds` and a commitment of `confirmed` or `provisional`. It cannot confirm, reject, or supersede a decision. The gate enforces that split.

The simulated analyst is the actor for:

- answering `ask_clarification`;
- Apply or Reject on each proposal;
- accepting or withdrawing impact links (new links stay `proposed` until accepted);
- confirming or rejecting a decision through the decision API, with `actorRole` set to the role id and `confirmationEvidence` set to a task-packet span id or a stakeholder-script answer id.

Commitment `override` is unused. A session that records an override is `protocol_stopped`. Automatic mode stays off, so the gate’s auto-mode refusal of override is consistent with this rule.

### 6.2 Stakeholder script, ask, and invent

The task packet is the simulated analyst’s requirements document. A frozen stakeholder script, written by humans before the run, may answer clarification questions for that Study B task. The script is stored outside the simulated-analyst context. The simulated analyst does not read it. The harness matches a question to a script entry and returns that entry, or the fixed token `no-authorized-answer`.

The script is not Study A gold, is not a Study B reference specification, and is not written or edited by a simulated analyst.

Answer order for a missing business fact:

1. If the task packet already states the fact, the simulated analyst uses that span and records the span id.
2. Otherwise the question is submitted to the stakeholder script.
3. If the script returns `no-authorized-answer`, the decision stays unresolved. The simulated analyst rejects a confirmed write that depends on the open choice. A write that is explicitly `provisional` may be accepted and remains provisional.
4. The simulated analyst does not add an option that the packet and the script did not provide, and does not select such an option.

Technical form of an already authorized fact (identifier shape, placement of a stated constraint, SOFL syntax for a stated rule) may be supplied within the role card’s skill claim. That supply is logged as a transcription, not as a decision confirmation.

The canned reply “use your best judgement” is a protocol violation.

### 6.3 Apply

Apply is legal only when all of the following hold:

1. Every new obligation in the proposal is a paraphrase or a formal transcription of the task packet or of an authorized answer already returned in this session.
2. The commitment is `provisional` when the write touches an element linked to an unresolved decision, unless the simulated analyst has already confirmed that decision from an authorized answer.
3. `impactElementIds` names the elements the text changes. A missing list or an empty list is a reject. An empty list is not “no impact”.
4. The role card’s skill claim covers the edit. In particular, `sim:junior-se` does not apply a new formal postcondition that it cannot trace to a stated sentence.

### 6.4 Reject

Reject when any of the following hold:

1. The proposal selects a business interpretation that the packet and the script have not authorized.
2. The proposal adds a function, data resource, constraint, scenario, operation, or invariant absent from the authorized text.
3. The proposal presents provisional text as a confirmed specification.
4. The proposal is an accept-all, an auto-approve, or a continuation that depends on an invented stakeholder answer.
5. The specification agent attempts to confirm, reject, or supersede a decision by itself.

Reject resumes the agent with the rejection recorded. The simulated analyst does not silently repair the proposal into a different business choice and then apply it.

### 6.5 Decision actions

- Confirm only when the selected alternative is the authorized answer. If the decision lists alternatives, the confirmation names one of those ids.
- Reject a decision only when the authorized answer places that alternative out of scope.
- Leave the decision unresolved when the answer is `no-authorized-answer`.
- Accept an impact link only when the task packet or the registered decision names that element as affected. Withdraw a link that names an unrelated element.
- Reopening a confirmed or rejected decision follows the ledger rule: the predecessor becomes `superseded` and a new unresolved successor is appended. The simulated analyst does not overwrite the old status in place.

### 6.6 Manual arm

The manual session does not open a specification agent. Calls to `list_decisions`, `register_decision`, `ask_clarification`, and `propose_*` are absent. `proposalsApplied` and specification-agent token totals are zero. A non-zero specification-agent call invalidates the session as `protocol_stopped`.

The simulated analyst edits through the base editor. Editor diagnostics may be read. Missing business facts use the same stakeholder script and the same `no-authorized-answer` rule. Questions and answers are logged. The invention rule in section 6.2 still applies to every edit the simulated analyst types.

### 6.7 C2 session loop

1. The specification agent proposes or asks.
2. The simulated analyst checks the proposal or question against the task packet and the role card.
3. A missing business fact is handled by section 6.2.
4. The simulated analyst applies or rejects under sections 6.3 and 6.4.
5. When an authorized answer closes a decision, the simulated analyst submits the decision API with `actorRole` equal to the role id.
6. The instance stops when the checklist holds or a budget is exhausted.
7. The harness writes the logs in section 7.

## 7. Logging

Logs are process traces for simulated analysts. They are the source of process completability and interaction counts. They are not human timing, and they are not Study A’s Silent Commitment Rate (SCR).

### 7.1 Session record

One `session.json` per session. Required fields:

| Field | Content |
| --- | --- |
| `protocolId` | `study-b-sim-1` |
| `instanceId` | Id of the simulated-analyst instance |
| `roleId` | `sim:junior-se`, `sim:mid-re`, or `sim:senior-fm` |
| `cell` | `MB-a`, `BM-b`, `MB-b`, or `BM-a` |
| `sessionIndex` | `1` or `2` |
| `arm` | `manual` or `C2` |
| `taskVariantId` | Study B variant id |
| `taskPairId` | Matched pair id |
| `manifestHashes` | Study A held-out, Study A development, Study B pool |
| `trainingPacketHash` | Shared training packet |
| `stakeholderScriptHash` | Script for this variant; empty only if the packet states that the variant has no script |
| `modelConfigHash` | Simulator model settings; plus the specification-agent model settings on C2 |
| `stopReason` | One of the four outcomes in section 5.4 |
| `deliverableChecklist` | Item id to held / open |

Token and turn fields, stored as integers:

- `simulatorTurns`, `simulatorTokensIn`, `simulatorTokensOut` on both arms;
- `specificationAgentTurns`, `specificationAgentTokensIn`, `specificationAgentTokensOut` on C2, and `0` on `manual`;
- `clarificationsAsked`;
- `clarificationsAnsweredFromPacket`;
- `clarificationsAnsweredFromScript`;
- `clarificationsUnanswered`;
- `proposalsApplied`, `proposalsRejected` (C2 agent proposals);
- `editorOperationsApplied`;
- `decisionsConfirmed`, `decisionsRejected`, `decisionsLeftUnresolved`;
- `linksAccepted`, `linksWithdrawn`;
- `provisionalWrites`, `gateRefusals`, `overrideCount`.

`overrideCount` greater than zero forces `protocol_stopped`.

### 7.2 Apply and reject events

Each Apply or Reject appends one event:

- `kind`: `apply` or `reject`;
- `proposalId`;
- `arm`;
- `roleId`;
- `elementIds`;
- `commitment`: `confirmed`, `provisional`, or `none`;
- `reasonCode`: `authorized-transcription`, `unresolved-kept-provisional`, `unauthorized-choice`, `missing-impact`, `role-skill`, `agent-tried-to-confirm`, `provisional-as-confirmed`, `auto-approve`, or `other` with a short note;
- `decisionIds` touched, which may be empty.

### 7.3 SCR-adjacent events

These events are Study B process events. They are stored in a file that is not the Study A SCR table. They are not pooled with Study A runs, and they are not reported as Study A’s Silent Commitment Rate.

| `kind` | When it is written |
| --- | --- |
| `decision_registered` | A decision is registered as unresolved |
| `gate_refused_confirmed_write` | The gate blocks a confirmed write |
| `impact_unknown_refused` | The gate blocks a write whose impact list is missing or empty |
| `provisional_stored` | A write is stored as provisional |
| `decision_confirmed` | The simulated analyst confirms from an authorized answer |
| `decision_rejected` | The simulated analyst rejects from an authorized answer |
| `link_accepted` / `link_withdrawn` | The simulated analyst accepts or withdraws an impact link |
| `override_commitment` | An override was recorded (session becomes `protocol_stopped`) |
| `unresolved_open_at_stop` | One event per decision that is still unresolved at stop |

Each event records log order, `decisionId` when there is one, `elementIds`, commitment, and actor: `specification-agent`, `simulated-analyst`, or `gate`.

A count of gold unresolved slots that were written as confirmed behavior before an authorized answer is an artifact check on Study B tasks. It is computed only after humans have frozen the Study B reference and a human reviewer has coded the artifact under section 8. Until that coding exists, the results file publishes the event log’s existence and does not publish the rate. The rate, when published, is a Study B simulation metric. It is not Study A SCR, and it is not an RQ3 result.

### 7.4 What the logs must not contain

The session archive does not contain SUS responses, workload responses, a human-minutes field, or a field whose name is participant or subject. Exports intended for human reviewers follow section 8 and omit role, arm, order, chat, and the decision ledger.

## 8. Human blind review of artifacts

E1–E6 scores and coverage scores are human judgements. Simulated analysts do not score them. The specification agent does not score them. This protocol does not define the six fault classes and does not contain scores. Reviewers use the frozen scoring manual, which follows the three-step method’s definitions and is version-hashed before any session.

### 8.1 Frozen gold

The Study B reference for each variant is frozen by humans before the first session that uses that variant. Those humans are not Annotator A, not Annotator B, and not a simulated analyst. The reference includes the material used for coverage and for E1–E6, the deliverable checklist, and the stakeholder script. Simulated analysts do not write, edit, or see these references.

Study B references live in a directory that is disjoint from the Study A confirmatory gold directory. Identifiers are not reused across those directories. Copying a label from one directory into the other is a protocol violation.

### 8.2 Blinding and reviewers

The review packet contains the stopped Informal, Hybrid, and GUI artifacts under a review id, the frozen rubric, and the frozen Study B reference for that variant. The packet omits role id, arm, cell, order, chat transcript, decision ledger, and harness logs.

Two human reviewers score independently. A third human adjudicates disagreements. Reviewers and the adjudicator are:

- not simulated analysts;
- not Annotator A;
- not Annotator B;
- not the operator who drove that instance’s sessions.

The paper states whether blinding held. Residual cues in the specification text are reported with the scores.

Artifact quality versus frozen gold may be reported only after this review. The report is preliminary simulation evidence about artifacts produced by simulated analysts. It is not a human-effort result and it does not answer RQ3.

Parser and type well-formedness may be computed from the tools and are reported as tool checks. They are not stakeholder-intent scores. An unparsed artifact is reported as unparsed. It is not counted as zero faults.

## 9. Downgrade and paper wording

### 9.1 Downgrade

Results of this protocol are preliminary simulation evidence. They cannot replace the human paired study.

The downgrade from the human Study B design is absolute for effort claims. Process completability and interaction counts describe simulated analysts at work. They are not human time, SUS, or workload, and they are not written as an answer to RQ3. Artifact quality versus frozen gold, after section 8, may be reported in the same preliminary section. A feasibility result stays in that section.

If the human paired study has not been run, the paper leaves RQ3 unanswered.

Planned work is written as planned work. This protocol is not a result.

### 9.2 Wording

Write **simulated analysts** in English. In Chinese text write 模拟分析人员.

| Use for these runs | Do not use for these runs |
| --- | --- |
| simulated analysts / 模拟分析人员 | participants, subjects, 参与者, 被试, 受试者 |
| preliminary simulation evidence | human study, user study, 人类实验 (as a label for these runs) |
| process completability | reduced analyst effort, time saved |
| interaction counts, turn budget, token budget | SUS, workload, NASA-TLX, minutes saved |
| artifact quality against a frozen Study B reference | a score produced by the simulated analyst |

A sentence that reports these runs can take this shape. Any counts belong in a later results file, not in this protocol:

> When human analysts could not be recruited, simulated analysts operated Agile-SOFL Studio under protocol `study-b-sim-1`. The runs provide preliminary simulation evidence on process completability, interaction counts, and artifact quality against frozen references. They do not measure human time, SUS, or workload, and they do not answer RQ3.

Forbidden shapes include “participants were faster”, “the user study found time savings”, “subjects reported lower workload”, “SUS was …”, and “RQ3 is supported” on the basis of these runs.

## 10. Separation checklist from Study A dual-annotation

Every box is true before a session starts, and again before a paper sentence is added. A false box blocks the session or the sentence.

| # | Check | Pass condition |
| --- | --- | --- |
| 1 | Identity | The role prompt and `roleId` name a simulated analyst. The actor field is `sim:junior-se`, `sim:mid-re`, or `sim:senior-fm`. |
| 2 | Annotators | The instance id, the role id, and the operator of the simulator are not Annotator A and are not Annotator B. |
| 3 | Held-out tasks | `taskVariantId` is absent from the Study A held-out confirmatory manifest. The manifest hash is in `session.json`. |
| 4 | Development tasks | `taskVariantId` is absent from the Study A development manifest, including source-hash and near-duplicate matches. |
| 5 | Context pack | The simulated-analyst context excludes Study A gold, Study A oracle keys, and Study B reference specifications. |
| 6 | Gold writes | No simulated-analyst output is copied into a gold file, an annotation sheet, or a Study B reference. |
| 7 | Reviewers | E1–E6 and coverage sheets are signed by human reviewers who are not Annotator A, not Annotator B, and not the simulated analyst. |
| 8 | Analysis join | The analysis script refuses to join Study B simulation logs to Study A scenario ids. |
| 9 | Wording | The draft uses simulated analysts for these runs and contains no SUS, workload, or human time-savings claim about them. |
| 10 | Claim strength | If section 8 has not been done, the draft reports process feasibility only, marked preliminary, and does not place it under RQ3. |
| 11 | Human study | Human paired-study logs, if they exist later, are stored and analysed apart from this archive. The two are not pooled. |

## 11. Freeze before any session

The following are hashed and stored before the first session. A change after the first session starts a new protocol id or an explicitly numbered amendment. Sessions from different hashes are not merged into one result.

- This protocol (`study-b-sim-1`) and the role-card schema.
- The three role prompts.
- The shared training packet and the arm-specific tool instructions.
- The Study B task-pool manifest and each stakeholder script.
- The Study A held-out confirmatory manifest and the Study A development manifest.
- The scoring manual used for later human review.
- Simulator model id, specification-agent model id, temperature, and budgets.
- The counterbalance seed and the full cell assignment.

The assignment file records the seed, each instance id, role id, cell, variant ids, and manifest hashes. It does not record outcomes. Outcomes stay in the session archive described in section 7.
