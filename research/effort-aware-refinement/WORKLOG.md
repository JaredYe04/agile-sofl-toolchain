# WORKLOG — time-ordered

## 2026-10-30 — P0 (repo audit, baseline, workspace init)

- **Setup:** `git clone https://github.com/JaredYe04/agile-sofl-toolchain` → HEAD `8f325df`.
  `git checkout -b research/effort-aware-refinement`.
- **Env:** Windows 11 Pro, Node v26.13.0, npm 11.20.0, git 2.56.0. `D:\repos` is the clone root;
  `D:\repos\EAIR` holds the master task book + `skills/`.
- **Install:** `npm ci` → exit 0.
- **Build:** `npm run build` → exit 0 (all 7 workspaces; studio electron-vite + stage:parse-bridge).
- **Test:** `npm test` → parser 493, gui 23, aspec 46, editor-api 196, language-server 50, vscode 84
  (all pass); studio 322 pass / **5 fail** (3 files):
  - `projectTemplate.test.ts`, `experimentTelemetry.test.ts` (4 tests) → `Electron failed to install
    correctly` (environmental; electron binary absent in sandbox).
  - `llmPromptsFsf.test.ts` → `expected '...implies...' not to match /\bimplies\b/i` (pre-existing:
    the `hybrid-generation` skill prompt in `skills.ts` contains "implies").
  - **1092 passing / 5 failing = fixed baseline.**
- **Audit (read-only):** read docs 25 (atomic req + refinement measurement), 26 (trace), 17 (informal/
  hybrid editor), 13 (module boundaries), README; read sources:
  - parser: `refine/atomicity.ts`, `index.ts` (public API), fsf/cdfd/refine structure, test tree.
  - aspec: `index.ts`, `trace/coverage.ts`, `generators/llm.ts`, `model.ts`, `refine/*`.
  - editor-api: `refinement.ts` (full state machine), file list.
  - studio: `llm/agentLoop.ts`, `llm/skills.ts`, `llm/agentTypes.ts`, `llm/experiment.ts`,
    `llm/chatEcnu.ts`, `projectService.ts`, main/renderer file trees.
  - `.github/workflows/ci.yml`, `examples/*` (library-system.asfl, library-informal.aspec),
    `docs/13`, `pnpm-workspace.yaml`, root `package.json`.
- **Key conclusions:**
  1. Existing toolchain is far more complete than its README: full agent loop + clarification + approval
     + permission + experiment-condition + telemetry + atomic-requirement refinement + trace provenance.
  2. Research gap = requirement-level typed structure + cost-aware question selection + first-class
     obligations + readiness policy + benchmark/oracle/baselines.
  3. `chatEcnuStream` is OpenAI-compatible → the user-authorized free lab API (`lab-qwen3.8-27b`) and
     ECNU (`ecnu-max`) can drive the agent; no paid API needed. `ruleBased.ts` generator = API-free
     offline fallback for mock replay.
  4. Module-boundary rule: new work should be a **new package** (`packages/refinement`) depending on
     parser (+ optionally aspec/editor-api), and studio consumes it — never import sibling `src/`.
- **Artifacts written:** `README.md`, `baseline-report.md`, `design/architecture.md`, `STATUS.md`,
  `WORKLOG.md`, `DECISIONS.md`, `BLOCKERS.md`, `handoff/latest.md`, `handoff/progress.json`.
- **Commit:** (P0 commit hash recorded in progress.json / handoff).
