# Monaco Demo

Minimal browser reference for **dual-channel** Agile-SOFL editing: direct `check()` markers (implemented) and optional LSP stdio bridge (reference script).

## Prerequisites

From the repository root:

```bash
npm install
npm run build
npm run build --prefix packages/language-server
```

## Build and run (check channel)

```bash
npm run build --prefix packages/monaco-demo
npm start --prefix packages/monaco-demo
```

Then open `http://localhost:4173` (or open `packages/monaco-demo/index.html` after building).

## What it does

- Loads Monaco Editor from CDN
- Bundles `@agile-sofl/parser` via esbuild into `dist/demo.js`
- Debounces edits (~350ms) and runs `check(source)`
- Renders parser diagnostics as Monaco markers

**Intentionally does not implement** FSF block UI or ContentWidget editors — those belong in the separate Electron + Vue project consuming `@agile-sofl/editor-api`.

## LSP stdio bridge (reference)

For Electron main-process integration, see `scripts/lsp-bridge.mjs`:

```bash
node packages/monaco-demo/scripts/lsp-bridge.mjs
```

Wire `stdin`/`stdout` to `monaco-languageclient` or your JSON-RPC layer. Full sequence diagram and API table: [12 — Electron 编辑器集成](../../docs/12-Electron编辑器集成.md).

## Related docs

- [10 — 编辑器路线图](../../docs/10-编辑器路线图.md)
- [11 — VS Code 扩展与 LSP](../../docs/11-VSCode扩展与LSP.md)
- [12 — Electron 编辑器集成](../../docs/12-Electron编辑器集成.md)

For production LSP in desktop apps, prefer spawning `packages/language-server/dist/server.js` from the Electron main process; use `@agile-sofl/editor-api` for block models and patches in the renderer.
