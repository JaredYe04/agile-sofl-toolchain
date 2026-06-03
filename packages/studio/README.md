# @agile-sofl/studio

Electron + Vue visual editor shell for Agile-SOFL. Consumes shared npm packages only — no dependency on the VS Code extension.

## Packages used

| Package | Role |
|---------|------|
| `@agile-sofl/parser` | Parse / check |
| `@agile-sofl/editor-api` | JSON DTOs, FSF/module graph models, patches |
| `@agile-sofl/language-server` | LSP stdio server (spawned from main process) |

## Development

From repository root:

```bash
npm install
npm run build --workspace @agile-sofl/parser
npm run build --workspace @agile-sofl/editor-api
npm run build --workspace @agile-sofl/language-server
npm run bundle --workspace @agile-sofl/language-server
npm run dev --workspace @agile-sofl/studio
```

## Scope

This package is an **empty shell**: sidebar shows `buildDocumentModel` output and LSP spawn status. Block UI, module graph canvas, and Monaco LSP client are implemented here over time.

See [docs/12-Electron编辑器集成.md](../../docs/12-Electron编辑器集成.md).
