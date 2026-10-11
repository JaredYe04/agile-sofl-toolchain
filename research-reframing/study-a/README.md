# Study A harness

Controlled comparison of the existing agent with Decision-Aware Specification Refinement (DASR) off (C1) and on (C2). The driver is `packages/studio/scripts/agent-harness/study-a.ts`. It calls the existing `runOnce` agent loop, the existing block schedule, and the existing retry wrapper. It is not a second agent.

## Conditions

| Id | What runs |
| --- | --- |
| C1 | Existing agent, agent condition T (parser + L1 + L2 + write gate), `AGILE_SOFL_DASR=0` |
| C2 | Same agent and condition T, `AGILE_SOFL_DASR=1` (decision records, impact fields, decision gate, audit) |
| C0 | Deferred. The studio has no generic-chat mode. Label B1 still runs the agent as T, so it is not a fair tool-free baseline. |

The primary contrast is C2 versus C1. See `../analysis-plan.md`.

## One command

From `packages/studio`:

```bash
node scripts/agent-harness/build.mjs
node .harness/study-a.mjs \
  --scenario ../../research-reframing/study-a/dev/scenarios/dev-library-renewal.json \
  --conditions C1,C2 \
  --repeats 1 \
  --dry-run \
  --score
```

`--dry-run` uses the harness fake model and needs no API key. That fake proposes a module without element ids. C1 applies it. C2's decision gate refuses it inside the agent loop, so the C2 artifact stays empty: SCR stays 0 and task completion is 0. Omit `--dry-run` to call the configured ChatECNU model (`ECNU_MODEL`, otherwise `ecnu-max`) at temperature 0.35. The command always writes `metrics.json`.

Recompute metrics from a finished key, without another model call:

```bash
node .harness/study-a.mjs --score-only --key <keyFile>
```

## What the command writes

- `study-config.json` — model id, temperature, prompt and tool-schema hashes, git commit, DASR flag for C1 and C2, harness sha256. `confirmatoryFreezeTag` is null on a dev run.
- `inputs/<scenarioId>.aspec` — the gold informal text, shared by C1 and C2.
- `runs/<id>/study-events.jsonl` — clarifications, oracle hits, proposals, final parse flag. Events do not name the condition.
- `runs/<id>/manifest.json` and `final-diagnostics.json` — analysis logs. They do name the condition.
- `runs/<id>/.agile-sofl/llm-calls.jsonl` — existing telemetry.
- `blinded/<id>/final.asfl` — artifact only.
- `metrics.json` — SCR and the guardrail rates. The scenario is the row. Replications are averaged inside the scenario.
- The key file (outside the output directory) maps run id to scenario, condition, and repeat.

`metrics.json` and `runs/` are analysis logs. Hand `blinded/` to a rater who should not see the condition.

## Scenarios in this directory

`dev/scenarios/` has five development examples: three underspecified tasks (library, clinic, parking), one clear control (warehouse), and one maintenance task (library loan period). They are marked `devExample: true` and `confirmatory: false`.

`held-out/scenarios/` has fifteen draft packages (`set: held-out`, `status: draft-gold`). Nine are underspecified, three are clear controls, and three are maintenance tasks, across fifteen small-app domains. They are not dual-annotated and they are not the confirmatory freeze. List them without a model call:

```bash
node .harness/study-a.mjs --list ../../research-reframing/study-a/held-out
```

## Freeze tag

`exp-freeze-v1.2` is the pre-DASR pilot freeze. A confirmatory Study A run must use a new tag cut after DASR landed:

```bash
node .harness/study-a.mjs --confirmatory --freeze-tag <new-tag> --scenario <held-out.json> --allow-held-out ...
```

That mode refuses `exp-freeze-v1.2`, refuses a tag that is not `HEAD`, and refuses every DEV scenario. The proposed confirmatory tag is `study-a-freeze-v0.1`, cut only after DASR has merged and the held-out files have been dual-annotated. Until `freeze-checklist.md` is complete, do not pass these draft files to `--confirmatory`. C0 is not a condition on this command.
