# P0 Baseline Report — Agile-SOFL Toolchain

- **Branch:** `research/effort-aware-refinement`
- **Baseline commit:** `8f325dfe32db9e2c3498032860fa7bc0cb450227`
- **Clone source:** `https://github.com/JaredYe04/agile-sofl-toolchain`
- **OS:** Windows 11 Pro 10.0.26200 (win32), Shell: Git Bash
- **Node:** v26.13.0 (repo requires >=18) · **npm:** 11.20.0 · **git:** 2.56.0.windows.4
- **Date:** 2026-10-30

## Commands run (exact)

| Step | Command | Result |
|---|---|---|
| Install | `npm ci` | **exit 0** (lockfile `package-lock.json`; node_modules populated) |
| Build (all workspaces) | `npm run build` | **exit 0** (parser→gui→aspec→editor-api→language-server→vscode→studio; studio electron-vite build + `stage:parse-bridge` OK) |
| Full test suite | `npm test` (ordered per-workspace `vitest run`) | **exit 1** — see failures below |
| Boundaries | `npm run check:boundaries` | run in CI; local command available (not re-run yet, see next actions) |

## Per-workspace test results (from `npm test`)

| Workspace | Test files | Tests | Status |
|---|---|---|---|
| `@agile-sofl/parser` | 50 passed | **493 passed** | ✅ |
| `@agile-sofl/gui` | 1 passed | **23 passed** | ✅ |
| `@agile-sofl/aspec` | 5 passed | **46 passed** | ✅ |
| `@agile-sofl/editor-api` | 32 passed | **196 passed** | ✅ |
| `@agile-sofl/language-server` | 11 passed | **50 passed** | ✅ |
| `agile-sofl` (vscode) | 4 passed | **84 passed** | ✅ |
| `@agile-sofl/studio` | 3 failed / 71 passed | **5 failed / 322 passed** | ⚠️ |

**Total: 1092 passing, 5 failing.** All failures are confined to the studio package and are
**pre-existing at the baseline commit** (reproduced on a clean checkout before any research change).

## Pre-existing failures (baseline, NOT caused by research work)

1. `tests/projectTemplate.test.ts` — **file-level failure**:
   `Error: Electron failed to install correctly, please delete node_modules/electron and try
   installing again` (from `node_modules/electron/index.js`). **Environmental** — the Electron
   binary did not download in this sandbox (no GUI / network-restricted install). Not a code defect.
2. `tests/experimentTelemetry.test.ts` — 4 failing tests, same **Electron install** error (the file
   transitively imports the electron binary). Environmental.
3. `tests/llmPromptsFsf.test.ts` → `do not mention implies or => as a logical operator` —
   `AssertionError: expected 'Turn Informal Specification into Hybr…' not to match /\bimplies\b/i`.
   **Pre-existing content conflict**: the `hybrid-generation` skill prompt (in
   `packages/studio/src/main/services/llm/skills.ts`) uses the word "implies" in a sentence that the
   grammar-guard test forbids. This is a real (minor) baseline defect, independent of this research.

### Disposition
- These 5 failures are **recorded as the baseline**. Per task-book rule §2.6, they are NOT attributed
  to new work and are NOT worked around with `skip`. The 4 Electron failures are environmental and will
  be re-checked once the Electron binary is available; the 1 prompt test is a genuine pre-existing
  defect that I will leave untouched unless a research change touches that prompt (I will not "fix"
  unrelated product prompts under a research branch without an ADR).
- **No baseline regression** is acceptable for the 1092 passing tests; the 5 failures are the
  fixed starting set. My changes must not add new failures and must keep the non-studio packages green.

## CI canonical commands (`.github/workflows/ci.yml`, Node 20, ubuntu-latest)

```bash
node scripts/check-boundaries.mjs
npm ci
npm run build --workspace @agile-sofl/parser
npm run build --workspace @agile-sofl/editor-api
npm run build --workspace @agile-sofl/language-server
npm run bundle --workspace @agile-sofl/language-server
npm run test --workspace @agile-sofl/parser
npm run test --workspace @agile-sofl/editor-api
npm run test --workspace @agile-sofl/language-server
npm run test --workspace @agile-sofl/studio
npm run highlight:check --workspace agile-sofl
npm run coverage --workspace @agile-sofl/parser
npm run bench:parse --workspace @agile-sofl/parser -- --assert-p95=100 --assert-ecommerce-p95=150
```

## Reproducible research validation entrypoint (planned)

`npm run research:check` (added in P3) will run the non-Electron packages + the research package's
unit/contract/property tests + an offline benchmark smoke, so CI and local runs match without needing
the Electron binary.

## Environment notes / blockers

- **Electron binary** is the only environmental gap (affects 4 studio test files). It does not block
  parser/aspec/editor-api/language-server/vscode work, which is where the research core lives. The
  research package and its benchmark harness will be designed to run **without Electron** (headless
  Node + the OpenAI-compatible LLM client), so the 4 electron failures are non-blocking for the study.
- **LLM access:** the Studio's `chatEcnuStream` client is OpenAI-compatible (`/chat/completions`,
  Bearer key, streaming tools). The user-authorized free APIs (lab internal `lab-qwen3.8-27b` and
  ECNU `ecnu-max`) are both OpenAI-compatible and can be pointed at via `ECNU_API_KEY` /
  `ECNU_API_BASE_URL` / `ECNU_MODEL` env — no new client needed. No paid API is used.
- **Safety-classifier flapping:** during P0 the harness's command-safety classifier intermittently
  timed out, blocking some Bash/Write calls transiently. This is an environment hiccup, not a repo
  issue; commands were retried until they succeeded.
