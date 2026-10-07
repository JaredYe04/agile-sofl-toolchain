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

## 3. Real batch (serial; 2 systems x 3 conditions x 5 repeats = 30 runs, 20 of them with LLM calls)
    cd <worktree>/packages/studio
    node .harness/batch.mjs --systems classroom,delivery --conditions T,B2,B0-auto --repeats 5 [--max-approvals 8]

The command prints the output directory and the key file:
- **Output** (default `.harness/batch-<time>/`):
  - `blinded/<runId>/final.asfl` and `blinded/<runId>/steps/<n>.asfl`: final hybrid spec and the spec after
    each approved step, to hand to coders.
  - `runs/<runId>/`: manifest (maxApprovals, tool commit, freeze check, harness sha256), final-diagnostics.json,
    `steps/<n>.asfl` with `steps.jsonl` / `steps.csv` (parser, L1 and L2 error/warning counts of every snapshot,
    computed by the full checker regardless of condition), and `.agile-sofl/llm-calls.jsonl`. The telemetry
    names the condition, so don't give `runs/` to coders. B0-auto has a single snapshot (step 1).
  - `batch.json` (incl. `stepSummary`: per step n, mean counts over the ok runs that reached n, all conditions
    pooled) and `retries.log` (429/503 backoff).
- **Key file** (default `../../../agile-sofl-batch-keys/batch-<time>.key.json`, outside the outputs): maps each
  run id to its system, condition, repeat, order, prompt hash and number of steps, plus `stepSummaryByGroup`
  (the per-step aggregate per system/condition).

The batch aborts on a prompt-hash mismatch within a system, or after 3 consecutive run errors.
Condition B0-auto is the rule-based generator (`@agile-sofl/aspec` `refineAspecWithCheck`); it makes no LLM calls.

## Windows notes
- Informal inputs are read with BOM stripped and CRLF normalised to LF (`informal.ts`), so a Windows checkout
  with `core.autocrlf=true` gives the same prompt, prompt hash (manifest `promptHash`, `informalSha256`) and
  B0-auto output as Linux/macOS. The harness sha256 is computed over LF-normalised files for the same reason.
- git is always called with `-c safe.directory=<repo>`; run the commands from PowerShell or cmd as shown
  (no shell-specific quoting needed).
