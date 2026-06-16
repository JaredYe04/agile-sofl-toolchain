# Task 1 Manual Checklist — Informal + Hybrid Editor

Run Studio (`npm run dev -w @agile-sofl/studio`) and verify:

- [x] **New Informal Spec** (File → New Informal / template) opens `.aspec` tab with YAML + visual form
- [x] Edit **system purpose**, **assumptions**, **stakeholders** in System overview card; Monaco YAML updates
- [x] Edit **types / variables / invariants / constants / glossary** in module/system cards (add/remove entries)
- [x] Toggle **book alignment** card; edit functions/data/constraints sections; **book-align strict** via Command Center
- [x] Edit **process** description, pre/postconditions, scenarios; **function** bodyHint and **signature**
- [x] **Format YAML** toolbar button and Edit → Format Document normalize `.aspec`
- [x] Style diagnostics appear in issues panel for invalid `.aspec`; click diagnostic reveals line in Monaco
- [x] **Refine to Hybrid** wizard: target linked/new, per-process merge table, diff, coverage %, check diagnostics
- [x] Apply refinement opens/updates `.asfl` tab; paired tabs linked
- [x] Refined `.asfl` passes check (no parse errors in issues panel)
- [x] `.aspec.trace.json` written when refinement is **applied** (not on every aspec save)
- [x] Edit informal `.aspec`; coverage shows **stale** when trace hash differs; save updates `contentHash`
- [x] **Coverage panel**: click process/function → jumps to hybrid symbol; click type/var/inv → informal id
- [x] **Informal regions** panel lists FSF/comment spans; click reveals; double-click edits text
- [x] Hybrid editor shows **region decorations** (FSF / informal / comment / decom)
- [x] Predicate builder can add **informal** atom nodes (auto-blocked on linked bottomLevel; strict mode elevates errors)
- [x] Command Center: `>fsf strict`, `>book-align strict`, `>refine`, `>coverage`, `>Open Folder` commands work
- [x] **Open Folder** populates sidebar pairs view; click opens `.aspec` / `.asfl` files
- [ ] **Project sidebar**: Ctrl+B / toolbar toggle collapse; drag resize (200–420px); hover left edge to expand when collapsed; pair cards show `.guispec`; right-click item/panel (reveal, copy path, refresh, close project)
- [x] **GUI tab** (New GUI Spec / `.guispec`): screen tree, widget CRUD, Cursor-style wireframe preview
- [x] **GUI Preview mode**: button/navigation triggers screen navigation; widget selection syncs property panel
- [x] **Informal GUI panel**: switch Informal ↔ GUI on `.aspec` tab; embedded gui patch updates YAML
- [x] Coverage panel includes **gui-screen** entries when GUI spec is linked
- [x] Hybrid module overview shows **GUI block summary** when `.asfl` contains `gui` block

Automated coverage: `npm test -w @agile-sofl/gui && npm test -w @agile-sofl/aspec && npm test -w @agile-sofl/studio`

Verified: 2026-06-16 (Task 1 full delivery — code review + automated tests)

Implemented in code (covered by automated tests where noted):

| Feature | Test coverage |
|---------|---------------|
| aspec parse/validate/refine/coverage/merge/patch-by-id/constants/glossary | `@agile-sofl/aspec` (23 tests) |
| function FSF refine, emitGuiBlock, trace contentHash | `phase1Extras.test.ts` |
| documentKind aspec/asfl/guispec, tab pairs | `documentStore.test.ts`, `tabUtils.test.ts`, `newFileDialog.test.ts` |
| format document (asfl), bookAlignStrict IPC | `formatDocument.test.ts`, `informalModel.test.ts` |
| visual patch IPC, FSF strict severity | `visualPatch.test.ts`, `@agile-sofl/editor-api` |
| ASFL gui block parse/check | `@agile-sofl/parser` `guiBlock.test.ts` |
| GUI model/validate | `@agile-sofl/gui` (10 tests) |
