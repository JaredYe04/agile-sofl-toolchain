# Agile-SOFL Toolchain

**English** | [中文](#中文)

Agile-SOFL is a lightweight formal specification language for describing software systems. It combines structured modules, type definitions, process specifications, FSF scenarios, and informal annotations in a single `.asfl` file.

This repository is an **npm workspaces monorepo** that provides the full Agile-SOFL toolchain:

- Parser and semantic analysis library (`@agile-sofl/parser`)
- Editor API for visual editors (`@agile-sofl/editor-api`)
- Language Server (`@agile-sofl/language-server`)
- VS Code / Cursor extension (`agile-sofl`, distributed as `.vsix`)
- Electron + Vue visual editor shell (`@agile-sofl/studio`)

Shared libraries and product lines communicate through **npm packages** and **LSP / JSON contracts** — product packages do not import each other's source code.

| Package | Path | Artifact | Description |
|---------|------|----------|-------------|
| `@agile-sofl/parser` | `packages/parser` | npm | Parse, analyze, validate, classify FSF scenarios, format `.asfl` files; CLI (`asfl`) |
| `@agile-sofl/editor-api` | `packages/editor-api` | npm | JSON DTOs, patch APIs, module graph models for visual editors |
| `@agile-sofl/language-server` | `packages/language-server` | bundled `dist/server.js` | LSP over stdio (diagnostics, completion, semantic tokens, etc.) |
| `agile-sofl` | `packages/vscode` | `.vsix` | Syntax highlighting, diagnostics, formatting, outline view |
| `@agile-sofl/studio` | `packages/studio` | desktop app (private) | Electron + Vue shell for block-based visual editing (in progress) |

---

# English

## What is Agile-SOFL?

Agile-SOFL is a hybrid formal specification language designed to describe software systems in a structured and readable way.

An Agile-SOFL specification typically consists of:

- Modules
- Constants and type definitions
- Variables and invariants
- Processes with preconditions and postconditions
- Functions
- FSF scenario specifications
- Informal comments and decomposition notes

A common workflow is:

1. Write a specification in an `.asfl` file
2. Validate it using the parser or CLI
3. Format it automatically
4. Edit in VS Code / Cursor (text + LSP), or in Studio (visual editor, planned)

---

## Features by Package

### Parser (`@agile-sofl/parser`)

| Feature | API / Command | Description |
|---------|---------------|-------------|
| Parse | `parse()`, `parseModule()` | Parse source into AST |
| Type checking | `check()` | Semantic analysis and type validation |
| FSF classification | `classifyFsf()` | Formal / semi-formal / informal scenario analysis |
| Formatting | `format()`, `printProgram()` | 4-space indentation |
| Inspection | `inspect()`, `asfl inspect` | Human-readable analysis reports |
| Project index | `ProjectIndex` | Cross-file symbol index and definitions |
| CLI | `asfl check`, `format`, `inspect`, `repl` | Batch and interactive workflows |

### Editor API (`@agile-sofl/editor-api`)

| Feature | Description |
|---------|-------------|
| `buildDocumentModel()` | JSON document model for UI sidebars and status |
| `buildFsfModel()` / `patchFsfSpec()` | FSF block DTOs and source patching |
| `buildModuleGraph()` | Module relationship graph for canvas views |
| Re-exports | `ProjectIndex`, `checkIncremental`, `formatDocument`, etc. |

### Language Server (`@agile-sofl/language-server`)

| Feature | Description |
|---------|-------------|
| Diagnostics | Real-time syntax and semantic errors |
| Completion / hover / definition | Editor intelligence |
| Semantic tokens | AST-based highlighting beyond TextMate |
| Document symbols / folding | Outline and navigation |

Spawn entry point (shared by VS Code and Studio):

```text
node node_modules/@agile-sofl/language-server/dist/server.js --stdio
```

### VS Code / Cursor Extension (`agile-sofl`)

> Distributed as `.vsix`; not published to the VS Code Marketplace.

| Feature | Description |
|---------|-------------|
| Syntax highlighting | TextMate + semantic tokens |
| Live diagnostics | Via bundled language server |
| Formatting | Same formatter as the parser |
| Outline view | Modules, types, processes, functions |

### Studio (`@agile-sofl/studio`)

Electron + Vue shell for a future visual editor (FSF form blocks, module graph canvas). Currently demonstrates:

- Main process LSP spawn
- `buildDocumentModel` via IPC from `@agile-sofl/editor-api`

See `packages/studio/README.md` and `docs/12-Electron编辑器集成.md`.

---

## Example Specifications

| File | Highlights |
|------|------------|
| `examples/library-system.asfl` | Multi-module library system, collections, invariants, FSF |
| `examples/ecommerce.asfl` | Shopping cart, inventory, process aliases, nested modules |
| `examples/hospital-registration.asfl` | Registration workflows, functions, emergency and billing |

Integration fixture:

| File | Description |
|------|-------------|
| `packages/parser/tests/fixtures/integration/banking.asfl` | Banking spec used in docs and integration tests |

```bash
npm install
npm run build:parser

npx asfl inspect examples/library-system.asfl
npx asfl check examples/ecommerce.asfl
npx asfl format examples/hospital-registration.asfl
```

---

## Quick Start

### Clone and build the monorepo

```bash
git clone https://github.com/agile-sofl/agile-sofl-parser.git
cd agile-sofl-parser

npm install
npm run build
npm test
npm run check:boundaries
```

Build or test individual packages:

```bash
npm run build:parser
npm run build:lsp
npm run build:vscode
npm run build:studio

npm run test:parser
npm run highlight:check    # VS Code TextMate highlight tests
```

### Using the parser library

```typescript
import { parse, check, format, inspect } from '@agile-sofl/parser'

const { ast, diagnostics } = check(source)
const { source: formatted } = format(source)
const report = inspect(source, { tree: true })
```

### Using the CLI

```bash
npx asfl inspect my-spec.asfl
npx asfl check my-spec.asfl
npx asfl format my-spec.asfl
npx asfl repl
```

REPL commands: `:check`, `:tree`, `:tokens`, `:format`, `:help`, `:quit`

---

## VS Code Extension

Build and package:

```bash
npm run build:parser
npm run bundle-server --workspace agile-sofl
npm run package --workspace agile-sofl
# Output: packages/vscode/agile-sofl-*.vsix
```

Install: Extensions → `...` → **Install from VSIX...**

Development: open the repo root in VS Code and press **F5** (see `.vscode/launch.json`).

---

## Studio (Electron)

```bash
npm run build:parser
npm run build --workspace @agile-sofl/editor-api
npm run bundle --workspace @agile-sofl/language-server
npm run dev --workspace @agile-sofl/studio
```

---

## Documentation

| Resource | Description |
|----------|-------------|
| `docs/README.md` | Documentation index |
| `docs/08-API与CLI.md` | Parser API and CLI reference |
| `docs/10-编辑器路线图.md` | Editor roadmap |
| `docs/11-VSCode扩展与LSP.md` | VS Code extension and LSP |
| `docs/12-Electron编辑器集成.md` | Electron / Studio integration |
| `docs/13-模块边界与仓库结构.md` | Monorepo layout and module boundaries |

---

## Repository Structure

```text
agile-sofl-parser/          # npm workspaces root (private)
├── packages/
│   ├── parser/             # @agile-sofl/parser — lexer, parser, typecheck, CLI
│   ├── editor-api/         # @agile-sofl/editor-api — visual editor JSON API
│   ├── language-server/    # @agile-sofl/language-server — LSP
│   ├── vscode/             # agile-sofl — VS Code extension
│   └── studio/             # @agile-sofl/studio — Electron + Vue shell
├── examples/               # Sample .asfl specifications
├── docs/
└── scripts/
    └── check-boundaries.mjs
```

---

## Versioning and Releases

Packages are versioned independently where applicable:

| Package | Release channel | Tag format |
|---------|-----------------|------------|
| `@agile-sofl/parser` | npm | `vX.Y.Z` |
| `@agile-sofl/editor-api` | npm (optional) | semver |
| `@agile-sofl/language-server` | bundled with products | — |
| `agile-sofl` | GitHub Release (`.vsix`) | `extension-vX.Y.Z` |
| `@agile-sofl/studio` | private desktop build | — |

---

## License

MIT License. See [LICENSE](LICENSE).

---

# 中文

## 什么是 Agile-SOFL？

Agile-SOFL 是一种面向软件系统建模的混形式规格语言，通过结构化的方式描述系统行为与约束。

典型规格包含：模块、常量与类型、变量与不变式、进程（含前后置条件）、函数、FSF 场景、非形式化说明与分解注释。

常见流程：编写 `.asfl` → 解析/校验 → 格式化 → 在 VS Code / Cursor（文本 + LSP）或 Studio（可视化编辑器，规划中）中维护。

---

## 各包功能

### 解析器（`@agile-sofl/parser`）

| 功能 | API / 命令 | 说明 |
|------|------------|------|
| 解析 | `parse()`、`parseModule()` | 源代码 → AST |
| 类型检查 | `check()` | 语义分析与类型验证 |
| FSF 分类 | `classifyFsf()` | 场景形式化程度分析 |
| 格式化 | `format()`、`printProgram()` | 4 空格缩进 |
| 检查报告 | `inspect()`、`asfl inspect` | 人类可读分析报告 |
| 工程索引 | `ProjectIndex` | 跨文件符号与定义跳转 |
| CLI | `asfl check`、`format`、`inspect`、`repl` | 批处理与交互式使用 |

### 编辑器 API（`@agile-sofl/editor-api`）

| 功能 | 说明 |
|------|------|
| `buildDocumentModel()` | 侧边栏 / 状态栏用的 JSON 文档模型 |
| `buildFsfModel()` / `patchFsfSpec()` | FSF 块 DTO 与源码 patch |
| `buildModuleGraph()` | 模块关系图数据 |
| 再导出 | `ProjectIndex`、`checkIncremental`、`formatDocument` 等 |

### 语言服务（`@agile-sofl/language-server`）

诊断、补全、悬停、定义跳转、语义 token、大纲与折叠。VS Code 与 Studio 共用 stdio 入口：

```text
node node_modules/@agile-sofl/language-server/dist/server.js --stdio
```

### VS Code / Cursor 扩展（`agile-sofl`）

> 以 `.vsix` 私有分发，不上架 Marketplace。

语法高亮（TextMate + 语义 token）、实时诊断、格式化、大纲视图。

### Studio（`@agile-sofl/studio`）

Electron + Vue 可视化编辑器空壳（FSF 表单块、模块图画布待实现）。当前已具备：主进程 LSP spawn、`buildDocumentModel` IPC 演示。

详见 `packages/studio/README.md` 与 `docs/12-Electron编辑器集成.md`。

---

## 示例规格

| 文件 | 特性 |
|------|------|
| `examples/library-system.asfl` | 图书馆系统、多模块、集合、FSF |
| `examples/ecommerce.asfl` | 电商、库存、进程别名、子模块 |
| `examples/hospital-registration.asfl` | 挂号流程、函数、急诊与计费 |

集成测试夹具：`packages/parser/tests/fixtures/integration/banking.asfl`

```bash
npm install
npm run build:parser

npx asfl inspect examples/library-system.asfl
npx asfl check examples/ecommerce.asfl
npx asfl format examples/hospital-registration.asfl
```

---

## 快速开始

### 克隆并构建 monorepo

```bash
git clone https://github.com/agile-sofl/agile-sofl-parser.git
cd agile-sofl-parser

npm install
npm run build
npm test
npm run check:boundaries
```

按包构建 / 测试：

```bash
npm run build:parser
npm run build:lsp
npm run build:vscode
npm run build:studio

npm run test:parser
npm run highlight:check
```

### 使用解析器库

```typescript
import { parse, check, format, inspect } from '@agile-sofl/parser'

const { ast, diagnostics } = check(source)
const { source: formatted } = format(source)
const report = inspect(source, { tree: true })
```

### 使用命令行

```bash
npx asfl inspect my-spec.asfl
npx asfl check my-spec.asfl
npx asfl format my-spec.asfl
npx asfl repl
```

REPL：`:check`、`:tree`、`:tokens`、`:format`、`:help`、`:quit`

---

## VS Code 扩展

```bash
npm run build:parser
npm run bundle-server --workspace agile-sofl
npm run package --workspace agile-sofl
# 产物：packages/vscode/agile-sofl-*.vsix
```

安装：扩展页 → `...` →「从 VSIX 安装」。开发调试：以仓库根目录打开 VS Code，按 **F5**。

---

## Studio（Electron）

```bash
npm run build:parser
npm run build --workspace @agile-sofl/editor-api
npm run bundle --workspace @agile-sofl/language-server
npm run dev --workspace @agile-sofl/studio
```

---

## 文档

| 文档 | 内容 |
|------|------|
| `docs/README.md` | 文档索引 |
| `docs/08-API与CLI.md` | 解析器 API 与 CLI |
| `docs/10-编辑器路线图.md` | 编辑器路线图 |
| `docs/11-VSCode扩展与LSP.md` | VS Code 扩展与 LSP |
| `docs/12-Electron编辑器集成.md` | Electron / Studio 集成 |
| `docs/13-模块边界与仓库结构.md` | Monorepo 结构与模块边界 |

---

## 仓库结构

```text
agile-sofl-parser/          # npm workspaces 根（private）
├── packages/
│   ├── parser/             # @agile-sofl/parser
│   ├── editor-api/         # @agile-sofl/editor-api
│   ├── language-server/    # @agile-sofl/language-server
│   ├── vscode/             # agile-sofl 扩展
│   └── studio/             # @agile-sofl/studio
├── examples/
├── docs/
└── scripts/
    └── check-boundaries.mjs
```

---

## 版本发布

| 包 | 发布方式 | 标签 |
|----|----------|------|
| `@agile-sofl/parser` | npm | `vX.Y.Z` |
| `@agile-sofl/editor-api` | npm（可选） | semver |
| `@agile-sofl/language-server` | 随产品 bundle | — |
| `agile-sofl` | GitHub Release（`.vsix`） | `extension-vX.Y.Z` |
| `@agile-sofl/studio` | 私有桌面构建 | — |

---

## 许可证

MIT License，详见 [LICENSE](LICENSE)。
