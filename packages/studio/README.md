# @agile-sofl/studio

Electron + Vue visual editor for Agile-SOFL specifications.

## Features

- Frameless custom title bar (File / Edit / View / Help menus, window controls)
- **Home tab** on startup with New / Open and recent files list
- **New file templates**: blank, minimal module, and curated examples (library, ecommerce, etc.)
- Multi-tab `.asfl` editor with New / Open / Save / Save As
- **Default split view**: Monaco + visual editor side by side
- **Visual editor (Phase 2a)**: module tree, declaration overview, FSF scenario forms with live code sync
- **Editor toolbar**: split / code / visual modes; minimap and line number toggles
- Monaco TextMate syntax highlighting (scope map → theme tokens; Monarch fallback)
- LSP via multi-strategy spawn (utilityProcess → Node → Electron-as-Node)
- Help → Developer Tools (`Ctrl+Shift+I`)
- Light / dark / system theme
- i18n: 简体中文 + English

## Quick start (Windows)

From repository root, run `studio.bat` — it builds parser + language server bundle, then starts the dev app:

```bat
studio.bat
```

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
| Renderer | Vue 3 + Pinia + Tailwind + Monaco + monaco-languageclient + `@agile-sofl/editor-api` |

See [docs/12-Electron编辑器集成.md](../../docs/12-Electron编辑器集成.md), [docs/14-Studio-UI设计规约.md](../../docs/14-Studio-UI设计规约.md), and [docs/15-Studio可视化编辑器.md](../../docs/15-Studio可视化编辑器.md).
