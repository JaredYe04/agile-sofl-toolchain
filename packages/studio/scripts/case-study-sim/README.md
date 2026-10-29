# Case-study simulation runner (P4–P23)

Headless ChatECNU + frozen `agent-loop` for **agent-simulated** software-engineer subjects.
This is **not** the classroom T/B2/B0-auto batch (`scripts/agent-harness/`). Do not mix the two pipelines.

Does not drive the Electron GUI. Does not invent interview quotes. `experience.json` follows the human P1 nested `feedback.mostHelpful` / `mostDifficult` / `suggestion` shape. Probe and feedback are written from session events (applied patches, clarification questions, matched task-packet facts, apply errors) — not raw telemetry dumps.

## Freeze

Batches must run on tag `exp-freeze-v1.2`. Running on `main` exits **2**.

```bash
cd packages/studio
node scripts/agent-harness/prepare-v12.mjs          # also copies this runner into the worktree
# or: node scripts/case-study-sim/prepare.mjs
cd ../../../agile-sofl-toolchain-v12/packages/studio
```

The API key stays in the original checkout (`packages/studio/.env.ecnu` or `.env`, gitignored). The worktree reads it in place via `.harness/v12-origin.json`. Never copy or commit keys.

## Commands

```bash
node .harness/case-study-sim.mjs --help                 # no key, no freeze
node .harness/case-study-sim.mjs --dry-run --pilot      # P4–P6, local fake LLM, no key
node .harness/case-study-sim.mjs --dry-run --subjects P4
node .harness/case-study-sim.mjs --pilot                # P4–P6 against ChatECNU
node .harness/case-study-sim.mjs                        # P4–P6, then auto-expand P7–P23 if the pilot wave is ok
```

`--concurrency` is clamped to **3**. HTTP calls inside one subject stay serial.

Real runs need `ECNU_API_KEY` (or `ecnu_api_key`) and talk only to `https://chat.ecnu.edu.cn/open/api/v1`. Default model alias `ecnu-max` → `deepseek-v4-flash` (`ecnu-plus` → `qwen3.8-flash`). Temperature is **0.35** (same hardcode as `agentLoop`).

## Output (copy into paper `data/case-study/P4–P23`)

Each subject folder:

```
P4/
  meta.json              # subjectType: agent-simulated, modelId, temperature, toolchainCommit/tag, timeWindow, materialsComplete
  experience.json        # formVersion 5-flexible-single-20261023; probe + nested feedback.mostHelpful/mostDifficult/suggestion
  informal.aspec
  hybrid.asfl
  session/events.jsonl   # real loop events only
  session/transcript.json
  artifacts/             # Studio project root used by the loop
  materials/task-brief.md
  screenshots/           # empty; screenshotsPrepared=false
```

## Subjects

`subjects.json` lists P4–P23. Pilot rows P4–P6 are fully specified (P6 seeds `fixtures/P6-FactoryMES-LineA.*`). P7–P23 follow the same schema.
