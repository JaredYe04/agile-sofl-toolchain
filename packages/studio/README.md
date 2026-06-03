# @agile-sofl/studio

Electron + Vue visual editor for Agile-SOFL specifications.

## Features (Phase 1)

- Frameless custom title bar (File / Edit / View / Help menus, window controls)
- Multi-tab `.asfl` editor with New / Open / Save / Save As
- Monaco editor with TextMate syntax highlighting (shared grammar from VS Code package)
- LSP integration via IPC bridge (`@agile-sofl/language-server`)
- Light / dark / system theme
- i18n: 简体中文 + English

## Development

From repository root:

```bash
npm install
npm run build --workspace @agile-sofl/parser
npm run build --workspace @agile-sofl/language-server
npm run bundle --workspace @agile-sofl/language-server
npm run dev --workspace @agile-sofl/studio
```

## Architecture

| Layer | Role |
|-------|------|
| Main | File dialogs, LSP stdio spawn + Content-Length IPC bridge, window controls |
| Preload | Typed `window.studio` API |
| Renderer | Vue 3 + Pinia + Tailwind + Monaco + monaco-languageclient |

See [docs/12-Electron编辑器集成.md](../../docs/12-Electron编辑器集成.md) and [docs/14-Studio-UI设计规约.md](../../docs/14-Studio-UI设计规约.md).
