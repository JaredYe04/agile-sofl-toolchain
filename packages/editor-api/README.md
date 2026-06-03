# @agile-sofl/editor-api

Stable JSON DTOs and patch helpers for Electron + Vue visual editors consuming Agile-SOFL specifications.

## Install

```bash
npm install @agile-sofl/editor-api @agile-sofl/parser
```

## API overview

| Function | Purpose |
|----------|---------|
| `buildDocumentModel(source)` | Modules + diagnostic summary |
| `buildHybridRegions(ast)` | FSF / informal / comment / decom spans |
| `buildFsfModel(process, source)` | Serializable FSF scenarios |
| `buildModuleGraph(ast)` | Nodes + edges for module/process graph UI |
| `buildSymbolIndex(ast, source)` | Flat symbol table |
| `patchFsfSpec` / `patchComment` / `patchInformal` | AST-driven text patches |
| `formatDocument(source)` | Full-document formatter |
| `ProjectIndex` / `checkIncremental` | Re-exported from `@agile-sofl/parser` |

See [docs/12-Electron编辑器集成.md](../../docs/12-Electron编辑器集成.md) for end-to-end integration.
