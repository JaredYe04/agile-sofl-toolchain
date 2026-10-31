# Headless agent CLI

Run the Agile-SOFL Studio specification agent without the Electron window.

An informal specification (`.aspec`) goes in. The agent proposes hybrid edits, the CLI applies them automatically, and a hybrid specification (`.asfl`) comes out, together with a run directory (manifest and call log).

```text
informal .aspec  →  headless agent loop  →  hybrid .asfl + run artifacts
```

API keys are read from the environment or an env file and are never printed.

## Prerequisites

Node.js 18 or newer. From the repository root, install dependencies and build the libraries the agent loads:

```bash
npm install
npm run build --workspace @agile-sofl/parser
npm run build --workspace @agile-sofl/gui
npm run build --workspace @agile-sofl/aspec
npm run build --workspace @agile-sofl/editor-api
```

The CLI bundles Studio's agent sources itself. It does not start Electron.

## Configure the model

Real runs call an OpenAI-compatible chat API that supports tool calls.

| Variable | Required | Default |
|----------|----------|---------|
| `ECNU_API_KEY` | yes, except `--dry-run` | |
| `ECNU_API_BASE_URL` | no | `https://chat.ecnu.edu.cn/open/api/v1` |
| `ECNU_MODEL` | no | `ecnu-max` |

Put them in the environment, in `packages/studio/.env`, or in a file passed with `--env-file`. Existing environment variables win. `.env` is not committed. The CLI keeps an empty profile list under `.harness/userdata` so the key is not copied into a profile store.

`--dry-run` uses a local fake model. It makes no network calls and does not need a key.

## Run

From the repository root:

```bash
node packages/studio/scripts/agent-harness/headless.mjs --help

node packages/studio/scripts/agent-harness/headless.mjs \
  --informal packages/studio/public/templates/minimal-informal.aspec \
  --dry-run \
  --out packages/studio/.harness/dry

node packages/studio/scripts/agent-harness/headless.mjs \
  --informal path/to/spec.aspec \
  --out packages/studio/.harness/out \
  --max-approvals 8
```

The same entry is available as an npm script (the working directory becomes `packages/studio`):

```bash
npm run agent:headless --workspace @agile-sofl/studio -- --help
npm run agent:headless --workspace @agile-sofl/studio -- --informal public/templates/minimal-informal.aspec --dry-run
```

`--informal`, `--out`, and the other file options are relative to the directory where you launched the command. The bundle itself runs with `packages/studio` as its working directory so workspace packages resolve.

`headless.mjs` builds `packages/studio/.harness/run.mjs` (gitignored) and runs it. To build once and invoke the bundle directly, from `packages/studio`:

```bash
node scripts/agent-harness/build.mjs
node .harness/run.mjs --informal public/templates/minimal-informal.aspec --dry-run
```

Informal files are read as UTF-8. A leading BOM is stripped and newlines are normalized to LF.

## Options

| Option | Meaning |
|--------|---------|
| `--informal <file>` | Informal specification. Required. |
| `--out <dir>` | Output directory. Default `.harness/out` under `packages/studio`. |
| `--initial-hybrid <file>` | Existing `.asfl` to revise. Omit to generate from the informal spec. |
| `--task <text>` / `--task-file <file>` | Task sent to the agent. Default: generate a hybrid specification. |
| `--skill <id>` | Agent skill. Default `hybrid-generation`. |
| `--max-approvals <n>` | Stop after this many auto-approved proposals (1–100, default 8). |
| `--clarification <text>` / `--clarification-file <file>` | One reply reused for every clarification question. |
| `--checks` / `--no-checks` | `--checks` (default) feeds parser and semantic checks back to the agent. `--no-checks` feeds parser diagnostics only. |
| `--dry-run` | Local fake model. Optional `--dry-run-delay-ms` (0–60000) pauses each fake call. |
| `--env-file <path>` | `KEY=VALUE` file. Does not override existing environment variables. |
| `--help`, `-h` | Usage. |

Skills: `hybrid-generation`, `hybrid-refinement`, `requirement-discovery`, `requirement-clarification`, `function-decomposition`, `data-modeling`, `constraint-discovery`, `specification-review`.

## What the loop does

Hybrid proposals are applied automatically, up to `--max-approvals`, using the same patch path as Studio. The agent then sees the tool result and can continue. Proposals aimed at other documents are returned as errors so the agent can recover. There is no preview window and no manual apply step.

If the agent asks a clarification and you did not pass `--clarification`, the CLI answers that no further stakeholder decision is available and that the agent must not invent business rules (thresholds, roles, limits, and similar choices). Pass `--clarification` when you want one fixed reply used for every question.

stdout and stderr redact `ECNU_API_KEY`. A real run retries HTTP 429 and 503 with backoff and appends each retry to `retries.log`.

## Output

| Path | Contents |
|------|----------|
| `<out>/hybrid.asfl` | Hybrid specification from this run |
| `<out>/runs/<id>/hybrid.asfl` | Same text |
| `<out>/runs/<id>/manifest.json` | Approvals, stop reason, prompt hash, skill, `checks`, `dryRun` |
| `<out>/runs/<id>/.agile-sofl/llm-calls.jsonl` | Model, token counts, and tool names. Prompt text is omitted unless `AGILE_SOFL_LOG_PROMPTS=1` |
| `<out>/retries.log` | HTTP 429/503 retries, when any occur |

The process prints one JSON object on stdout: `runId`, `out`, `hybrid`, `approvals`, `stopReason`, `hybridChars`, `checks`, `dryRun`, and a short `promptHash`.

`<out>` under `.harness/` is gitignored. Point `--out` somewhere else if you want to keep artifacts outside that directory.

## Example informal specification

```markdown
# Functions

## Add note

Save a short note for the current user.

# Data Resources

## Note

Text of a note.

# Constraints

## Non-empty

A note has non-empty text.
```

Save it as `note.aspec`, set `ECNU_API_KEY`, then:

```bash
node packages/studio/scripts/agent-harness/headless.mjs --informal note.aspec --out ./agent-out
```
