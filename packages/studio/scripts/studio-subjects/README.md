# Studio subject runner (P4–P23)

Run case-study subjects through the **Studio main process**, not the headless auto-approve harness.

The specification agent is `runAgentTurn` / `resumeWithToolResult` (the functions behind `studio:agent-chat` and `studio:agent-resume`). When a proposal is pending, the runner waits, then Accept or Reject:

- **Accept** calls `applyStudioProposal`, which uses the same services as the Agent panel: `applyInformalSourcePatch` / `applySourceEdits`, `applyHybridPatch`, `applyProjectRefinementStep`, `acceptHybridWrite`, and `patchGui`. The tool result is `{ action: 'applied', ... }` with warnings and diagnostics, then the loop resumes.
- **Reject** sends `{ action: 'rejected' }` and does not write the files. That is the same payload as AgentPanel's Reject button.

`proposal_decision` and, after an accepted hybrid write, `post_write_diagnostics` are logged by that resume path. This runner does **not** set `AGILE_SOFL_HARNESS_SKIP_POST_WRITE_DIAG`.

## Why this is not the Electron window

Driving the real Electron GUI from CI needs a display and is brittle. This runner does not click the window. It also does not use the old case-study path that applied every proposal immediately.

`electron` is stubbed only so `env.ts` and `profiles.ts` can load outside a BrowserWindow. The stub does not decide Accept or Reject. The project on disk is a real Studio project (`agile-sofl.json`, `informal.aspec`, `hybrid.asfl`, `gui.html`, `.agile-sofl/agent/sessions`).

Do not use `scripts/agent-harness` for these re-runs. That CLI auto-approves hybrid proposals in the same turn.

## Decisions

Each subject has a JSON policy in `models/P4.json` … `models/P23.json`. A small interpreter (`policy.ts`) reads it. There is no per-subject `if`.

The model carries:

- accept propensity and risk aversion (from the spec-work band and greenfield vs extension, plus a stable per-id jitter)
- penalties for large patches, removals, source edits, and refinement steps
- a lognormal thinking-time distribution; larger patches draw a longer time
- clarification answers from the subject's authorized task-packet facts only

**Production** sleeps the sampled time. Proposal draws are at least 3 seconds, and the runner refuses to sleep less than 2 seconds. There is no flag for a few-millisecond approve.

**Dry-run** records that sample as `intendedThinkingMs` and sleeps a compressed **1.0–2.2 seconds** so a pilot can finish without a long pause. It still does not approve in a few milliseconds.

Regenerate the checked-in models from `subjects.json`:

```bash
node packages/studio/scripts/studio-subjects/studio-subjects.mjs --generate-models
```

## Commands

From the repository root. `--help`, `--generate-models`, and `--dry-run` do not need an API key.

```bash
node packages/studio/scripts/studio-subjects/studio-subjects.mjs --help

node packages/studio/scripts/studio-subjects/studio-subjects.mjs --dry-run --subjects P4

node packages/studio/scripts/studio-subjects/studio-subjects.mjs --dry-run --pilot

npm run subjects:studio --workspace @agile-sofl/studio -- --help
```

Real runs need `ECNU_API_KEY` (alias `ecnu_api_key` is accepted and not printed). Optional: `ECNU_API_BASE_URL` (default `https://chat.ecnu.edu.cn/open/api/v1`) and `ECNU_MODEL` (default `ecnu-max`). Put them in the environment, in `packages/studio/.env`, or pass `--env-file`. Existing environment variables win. The CLI writes an empty profile list under `.harness/userdata` so the key is not copied into a profile store.

Pilot (P4–P6), then the full set:

```bash
node packages/studio/scripts/studio-subjects/studio-subjects.mjs --pilot --out ./studio-subjects-pilot

node packages/studio/scripts/studio-subjects/studio-subjects.mjs --all --out ./studio-subjects-p4-p23
```

`--concurrency` is 1 by default and at most 2. Calls inside one subject stay serial. `--max-decisions` bounds Accept/Reject choices per phase (default 8; dry-run default 2).

A full P4–P23 run is serial by default. Each proposal blocks on the sampled thinking time (several seconds, up to the model maximum of 55 seconds) plus one model round-trip. Plan the API quota for three phases on greenfield subjects (informal, hybrid, extension) and one extension phase on extension subjects, up to `--max-decisions` proposals per phase, plus clarification turns.

## Output

```text
<out>/<id>/manifest.json
<out>/<id>/events.jsonl          # intendedThinkingMs and sleptMs on every decision
<out>/<id>/agent-model.json
<out>/<id>/task-brief.md
<out>/<id>/project/              # Studio project the loop actually wrote
<out>/retries.log                # HTTP 429/503 retries, when any occur
```

stdout is one JSON summary. The API key is redacted from stdout and stderr.

`<out>` under `packages/studio/.harness/` is gitignored. This runner does not write paper `data/case-study` trees or questionnaire prose.

## Subjects

`subjects.json` is the P4–P23 task table (domain, experience band, task packet, authorized facts, and short extension seeds). P6 also uses `fixtures/P6-FactoryMES-LineA.*`. Those facts are the only clarification answers. Unmatched questions get a fixed reply that tells the agent not to invent business rules.
