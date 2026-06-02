# Agile-SOFL for VS Code / Cursor

Syntax highlighting, diagnostics, formatting, and document outline for **Agile-SOFL** (`.asfl`) specifications.

## Features

- TextMate grammar for keywords, types, FSF, and informal regions
- Language Server: parse/type diagnostics (debounced), document formatting, Outline view
- Works in VS Code and Cursor via the Marketplace

## Usage

Open any `.asfl` file. Diagnostics update as you edit; run **Format Document** for pretty-printing.

## Extension settings

| Setting | Default | Description |
|---------|---------|-------------|
| `agileSofl.trace.server` | `off` | LSP message trace level |
| `agileSofl.debounceMs` | `300` | Diagnostic debounce (ms) |

## Development

From the repository root:

```bash
npm install
npm run build
npm run build --prefix packages/language-server
node packages/language-server/scripts/bundle.mjs
npm run build --prefix packages/vscode
```

Press **F5** (Launch Agile-SOFL Extension) with the repo root as workspace folder.

Sample files: `examples/library-system.asfl`, `examples/ecommerce.asfl`, `examples/hospital-registration.asfl`.

## License

MIT — see [LICENSE](../../LICENSE) in the repository root.
