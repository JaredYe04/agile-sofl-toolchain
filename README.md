# Agile-SOFL Parser

TypeScript parser for **Agile-SOFL** hybrid specifications: lexing, parsing, AST with source spans, scope resolution, type checking, FSF formal/semi-formal classification, pretty-printing, and an interactive CLI.

## Quick start

```bash
npm install
npm run build
npm test
```

```typescript
import { parse, check, format, inspect } from '@agile-sofl/parser'

const { ast, diagnostics } = check(source)
const report = inspect(source, { tree: true })
console.log(report.text)
```

## CLI

```bash
npm run build
npx asfl inspect tests/fixtures/integration/banking.asfl
npx asfl check my-spec.asfl
npx asfl format my-spec.asfl
echo "module SYSTEM_T; var x: nat; end_module" | npx asfl inspect
npx asfl repl
```

REPL 内置命令：`:check`、`:tree`、`:tokens`、`:format`、`:clear`、`:help`、`:quit`。

## Documentation

See [docs/README.md](docs/README.md) for the full Chinese documentation index (language overview, grammar, FSF, API/CLI, testing).

### Parser (npm)

Root package `@agile-sofl/parser` — library + CLI. Published to npm via `publish.yml` (independent versioning).

### VS Code / Cursor extension

Editor stack lives under `packages/language-server` (LSP, bundled) and `packages/vscode` (Marketplace extension). See [docs/11-VSCode扩展与LSP.md](docs/11-VSCode扩展与LSP.md) for install, F5 dev, and release workflow. Example specs: `examples/*.asfl`.

## Project structure

- `src/lexer` — Chevrotain lexer and tokens
- `src/parser` — Parser, CST → AST
- `src/scope` — Module scope and symbol tables
- `src/typecheck` — Type checker
- `src/fsf` — FSF classifier
- `src/transform` — Normalize and pretty-print
- `src/cli` — `inspect` report and REPL
- `packages/language-server` — LSP (diagnostics, format, symbols)
- `packages/vscode` — VS Code / Cursor extension
- `examples/` — Large `.asfl` demo specifications
- `tests/` — Vitest suites and `.asfl` fixtures

## License

MIT
