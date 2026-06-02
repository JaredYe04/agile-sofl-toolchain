# Agile-SOFL for VS Code / Cursor

Syntax highlighting, diagnostics, formatting, and document outline for **Agile-SOFL** (`.asfl`) specifications.

**Distribution:** private / team use only — install from a **`.vsix`** file (not published to the VS Code Marketplace).

## Install from VSIX

1. Obtain `agile-sofl-X.Y.Z.vsix` (GitHub Release, or build locally — see below).
2. VS Code / Cursor: **Extensions** → **…** → **Install from VSIX…**
3. Open any `.asfl` file.

## Features

- TextMate grammar for keywords, types, FSF, and informal regions
- Language Server: parse/type diagnostics (debounced), document formatting, Outline view

## Extension settings

| Setting | Default | Description |
|---------|---------|-------------|
| `agileSofl.trace.server` | `off` | LSP message trace level |
| `agileSofl.debounceMs` | `300` | Diagnostic debounce (ms) |

## Build VSIX locally

From the repository root:

```bash
npm install
npm run build
npm run build --prefix packages/language-server
node packages/language-server/scripts/bundle.mjs
npm run package --prefix packages/vscode
```

Output: `packages/vscode/agile-sofl-0.x.x.vsix`

## Development (F5)

Press **F5** with the repo root as workspace folder. See [docs/11-VSCode扩展与LSP.md](../../docs/11-VSCode扩展与LSP.md).

Sample files: `examples/library-system.asfl`, `examples/ecommerce.asfl`, `examples/hospital-registration.asfl`.

## License

MIT — see [LICENSE](../../LICENSE) in the repository root.
