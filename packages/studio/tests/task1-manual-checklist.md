# Task 1 Manual Checklist — Informal + Hybrid Editor



Run Studio (`npm run dev -w @agile-sofl/studio`) and verify:



- [ ] **New Informal Spec** (File → New Informal / template) opens `.aspec` tab with YAML + visual form

- [ ] Edit **system purpose**, **assumptions**, **stakeholders** in System overview card; Monaco YAML updates

- [ ] Edit **types / variables / invariants** in module card (add/remove entries)

- [ ] Toggle **book alignment** card; edit functions/data/constraints sections

- [ ] Edit **process** description, pre/postconditions, scenarios; **function** bodyHint

- [ ] **Format YAML** toolbar button and Edit → Format Document normalize `.aspec`

- [ ] Style diagnostics appear in issues panel for invalid `.aspec` (LSP skipped for aspec)

- [ ] **Refine to Hybrid** wizard: target linked/new, per-process merge table, diff, coverage %

- [ ] Apply refinement opens/updates `.asfl` tab; paired tabs linked

- [ ] Refined `.asfl` passes check (no parse errors in issues panel)

- [ ] `.aspec.trace.json` written when informal file is saved on disk

- [ ] Edit informal `.aspec`; coverage shows **stale** when trace hash differs

- [ ] **Coverage panel**: click process/function → jumps to hybrid symbol; click type/var/inv → informal id

- [ ] **Informal regions** panel lists FSF/comment spans; click reveals; double-click edits text

- [ ] Hybrid editor shows **region decorations** (FSF / informal / comment / decom)

- [ ] Predicate builder can add **informal** atom nodes (disabled in strict FSF mode)

- [ ] Command Center: `>fsf strict`, `>refine`, `>coverage`, `>Open Folder` commands work

- [ ] **Open Folder** populates sidebar pairs view; click opens `.aspec` / `.asfl` files



- [ ] **GUI tab** (New GUI Spec / `.guispec`): screen tree, widget CRUD, Cursor-style wireframe preview
- [ ] **Informal GUI panel**: switch Informal ↔ GUI on `.aspec` tab; embedded gui patch updates YAML
- [ ] Coverage panel includes **gui-screen** entries when GUI spec is linked

Automated coverage: `npm test -w @agile-sofl/gui && npm test -w @agile-sofl/aspec && npm test -w @agile-sofl/studio`



Implemented in code (covered by automated tests where noted):



| Feature | Test coverage |

|---------|---------------|

| aspec parse/validate/refine/coverage/merge/patch-by-id | `@agile-sofl/aspec` (17 tests) |

| documentKind aspec/asfl, tab pairs | `documentStore.test.ts`, `tabUtils.test.ts` |

| format document (asfl) | `formatDocument.test.ts` |

| visual patch IPC | `visualPatch.test.ts` |


