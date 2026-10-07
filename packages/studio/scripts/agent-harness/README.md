# Agent harness and experiment batch runner

Run all commands from `packages/studio` unless noted. The scripts make no LLM calls unless a real batch is
started, and never print the API key.

## 1. Prepare a v1.2 worktree (once)
Batches must run on `exp-freeze-v1.2` (177749b). `main` contains later tool changes, so the batch refuses to run
there (exit 2). Prepare a worktree of the tag that uses the current harness scripts:

    node scripts/agent-harness/prepare-v12.mjs            # -> ../../../agile-sofl-toolchain-v12 (next to the repo)

This runs `npm ci`, builds the workspace packages and the harness, and records where this checkout's
`packages/studio/.env` is. The key is read from there in place and is not copied.

## 2. Dry run (no LLM calls, no key needed)
    cd <worktree>/packages/studio
    node .harness/batch.mjs --dry-run --repeats 1

`--dry-run-delay-ms <ms>` adds fake LLM latency, e.g. to try `--stop-at` and `--resume` in real time.

## 3. Real batch (serial; 2 systems x 3 conditions x 5 repeats = 30 runs, 20 of them with LLM calls)
    cd <worktree>/packages/studio
    node .harness/batch.mjs --systems classroom,delivery --conditions T,B2,B0-auto --repeats 5 --seed 20261008 --stop-at 08:00

- `--seed <n>` (0..4294967295; default: random, printed as `seed: <n>`): seeds the mulberry32 PRNG that builds
  the **block-randomised** schedule. Block k contains repeat k of every (system, condition) pair exactly once, in
  a seeded random order, so the 30 runs form 5 blocks of 6 and an interruption leaves the conditions balanced
  (to within one block). Seed, design and the full schedule (order -> system/condition/repeat/runId) are written
  **only to the key file**: with the seed, the schedule can be rebuilt, so treat it like the key.
- `--stop-at HH:MM` (local time): before each run, if it is at/after the next HH:MM following the session start,
  the batch stops cleanly without starting another run (a run already in progress finishes, so it can overrun
  by up to one run). `interruptedAt`, the next order and the reason go to the key file and `batch.json`
  (counts only). The command prints the resume command.

## 4. Resume an interrupted or aborted batch
    cd <worktree>/packages/studio
    node .harness/batch.mjs --resume "<keyFile>" [--stop-at HH:MM]

Continues the same schedule from the next unfinished order into the same output dir. It first re-checks the
freeze guard, tool commit, harness sha256, informal inputs and prompt hashes against the first session, and
refuses (exit 2) if any differ. Every session (start/end, runs done, end reason) and the per-run session index
are recorded in the key file only. A run that was cut off mid-way (process killed), or the run(s) of an error
streak that aborted a session (3 consecutive errors), is moved to `aborted/<runId>-a<n>/`, logged in
`aborted/aborted.log` and rerun from scratch with the same run id. A dry batch always resumes as a dry run.

The command prints the output directory and the key file:
- **Output** (default `.harness/batch-<time>/`):
  - `blinded/<runId>/final.asfl` and `blinded/<runId>/steps/<n>.asfl`: final hybrid spec and the spec after
    each approved step, to hand to coders.
  - `runs/<runId>/`: manifest (maxApprovals, tool commit, freeze check, harness sha256), final-diagnostics.json,
    `steps/<n>.asfl` with `steps.jsonl` / `steps.csv` (parser, L1 and L2 error/warning counts of every snapshot,
    computed by the full checker regardless of condition), and `.agile-sofl/llm-calls.jsonl`. The telemetry
    names the condition, so don't give `runs/` to coders. B0-auto has a single snapshot (step 1).
  - `retries.log`: every HTTP 429/503 retry and give-up, with local time, run id, run order and attempt.
  - `aborted/` (only after a resume): partial runs that were rerun, plus `aborted.log`.
  - `batch.json` (status, runs done, next order, interruptions; incl. `stepSummary`: per step n, mean counts over the ok runs that reached n, all conditions
    pooled).
- **Key file** (default `../../../agile-sofl-batch-keys/batch-<time>.key.json`, outside the outputs): seed,
  block design, full schedule, sessions and per-run session/attempt; maps each
  run id to its system, condition, repeat, order, prompt hash and number of steps, plus `stepSummaryByGroup`
  (the per-step aggregate per system/condition).

The batch aborts on a prompt-hash mismatch within a system, or after 3 consecutive run errors (resume it with `--resume`).
Condition B0-auto is the rule-based generator (`@agile-sofl/aspec` `refineAspecWithCheck`); it makes no LLM calls.

## Windows notes
- Informal inputs are read with BOM stripped and CRLF normalised to LF (`informal.ts`), so a Windows checkout
  with `core.autocrlf=true` gives the same prompt, prompt hash (manifest `promptHash`, `informalSha256`) and
  B0-auto output as Linux/macOS. The harness sha256 is computed over LF-normalised files for the same reason.
- git is always called with `-c safe.directory=<repo>`; run the commands from PowerShell or cmd as shown
  (no shell-specific quoting needed).
