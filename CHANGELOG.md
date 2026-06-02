# Changelog

All notable changes to `@agile-sofl/parser` are documented here.

## [0.1.0] - 2026-06-02

### Added

- Initial release: Chevrotain lexer and parser for Agile-SOFL
- AST with `Span` on every node; discriminated union + type guards
- Scope resolver with duplicate-module detection and parent-module visibility rules
- Type checker with built-in function signatures
- FSF formal / semi-formal classifier with diagnostic codes `ASFL_FSF_*`
- Pretty-printer with structural round-trip tests
- Public API: `parse`, `parseModule`, `check`, `format`, `walk`, `inspect`
- CLI: `asfl inspect|check|parse|format|repl` with ANSI report, stdin pipe, and REPL commands
- Banking integration fixture and expanded grammar/semantic test suites (106+ tests, ≥85% coverage)
- Self-contained Chinese documentation under `docs/`

### Fixed

- Type expression parsing: product (`*`) and union (`|`) types with lookahead gates
- Parser `typeExpr` ordering for nested `set of` / `map … to` without false product/union matches

## License

MIT
