/** Case-study simulation constants. Do not invent study quotes or events. */

export const FORM_VERSION = '5-flexible-single-20261023'
export const MAX_WORKERS = 3
export const DEFAULT_MAX_APPROVALS = 8
export const DRY_RUN_MAX_APPROVALS = 2
export const CHAT_ECNU_BASE = 'https://chat.ecnu.edu.cn/open/api/v1'
export const PILOT_IDS = ['P4', 'P5', 'P6'] as const
export const SUBJECT_ID_RE = /^P([4-9]|1\d|2[0-3])$/

/** ChatECNU aliases → upstream model ids recorded in meta.json. */
export const MODEL_ALIASES: Record<string, string> = {
  'ecnu-max': 'deepseek-v4-flash',
  'ecnu-plus': 'qwen3.8-flash'
}

export const HELP = `Case-study simulation runner (P4–P23). Headless ChatECNU + frozen agent-loop.
Does not drive the Electron GUI. Does not replace packages/studio/scripts/agent-harness/.

Must run on exp-freeze-v1.2 (see prepare-v12). Off-freeze exits 2.
At most 3 concurrent subject workers; HTTP inside one subject is serial.

Usage (from packages/studio of the v1.2 worktree):
  node scripts/case-study-sim/prepare.mjs          # wraps agent-harness/prepare-v12.mjs + copies this runner
  node .harness/case-study-sim.mjs --help
  node .harness/case-study-sim.mjs --dry-run --pilot
  node .harness/case-study-sim.mjs --dry-run --subjects P4
  node .harness/case-study-sim.mjs --pilot
  node .harness/case-study-sim.mjs                 # P4–P6, then auto-expand P7–P23 if the pilot wave is ok

Options:
  --help                 print this text and exit 0 (no key, no freeze)
  --dry-run              local fake LLM; no network; no API key
  --pilot                P4–P6 only
  --expand               P7–P23 only
  --subjects P4,P5       explicit ids
  --out <dir>            default .harness/case-study-<stamp>/
  --env-file <path>      KEY=VALUE file (never printed). Also reads .env.ecnu / .env / v12-origin
  --concurrency <n>      1..3 (clamped to 3)
  --max-approvals <n>    auto-applied proposals per phase (default 8; dry-run 2)
  --skip-expand          with default mode, stop after the P4–P6 wave

Env: ECNU_API_KEY or ecnu_api_key; ECNU_MODEL (default ecnu-max);
     ECNU_API_BASE_URL (default ${CHAT_ECNU_BASE}).
Key files: packages/studio/.env.ecnu (gitignored) or .env. Never commit keys.
`
