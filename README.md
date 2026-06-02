# Agile-SOFL Parser & Editor Tools

**English** | [中文](#中文)

Monorepo for **Agile-SOFL** (`.asfl`) — a hybrid formal specification language combining structured modules, types, FSF scenario specs, and informal annotations. This repository ships two **independently versioned** product lines:

| Product line | Package / artifact | Purpose |
|--------------|-------------------|---------|
| **Parser library** | npm [`@agile-sofl/parser`](https://www.npmjs.com/package/@agile-sofl/parser) | Parse, type-check, classify FSF, format, CLI |
| **Editor stack** | VS Code / Cursor extension **Agile-SOFL** (private **`.vsix`**) | Syntax highlighting, LSP diagnostics, formatting, outline |

---

## English

### What this repository does

Agile-SOFL specifications describe software systems as **modules** with constants, types, variables, invariants, **processes** (with FSF pre/post conditions), and **functions**. This repo implements the full toolchain to read, analyze, and edit those specs:

1. **Lexer & parser** (Chevrotain) — `.asfl` source → AST with source spans  
2. **Semantic analysis** — module scope, symbol tables, type checking  
3. **FSF classifier** — formal vs semi-formal scenario classification  
4. **Pretty-printer / formatter** — AST → canonical text with **4-space semantic indentation**  
5. **CLI & REPL** — `inspect`, `check`, `format`, interactive exploration  
6. **Language Server + VS Code extension** — real-time diagnostics, Format Document, document symbols  

Use the **npm package** in build pipelines, Node tools, or tests. Use the **extension** (installed from `.vsix`) for day-to-day editing in VS Code or Cursor.

### Features

#### Parser library (`@agile-sofl/parser`)

| Feature | API / command | Description |
|---------|---------------|-------------|
| Parse | `parse()`, `parseModule()` | Syntax → AST; parse diagnostics with stable codes (`ASFL_*`) |
| Type check | `check()` | Parse + scope resolution + type checking |
| FSF classification | `classifyFsf()` | Formal / semi-formal / informal scenario analysis |
| Format | `format()`, `printProgram()` | 4-space indent: block keywords flush left, body +4 spaces; FSF one scenario per line |
| Inspect | `inspect()`, CLI `asfl inspect` | Human-readable report (diagnostics, optional AST tree) |
| Walk visitor | `walk(ast, visitor)` | Traverse modules, types, vars, processes, functions |
| Normalize / compare | `normalizeAST()`, `astEqual()` | Testing and round-trip validation |
| CLI | `asfl check`, `format`, `inspect`, `repl` | Batch and interactive use |

#### VS Code / Cursor extension (`packages/vscode`)

> **Not published to the VS Code Marketplace.** Install manually from a `.vsix` file (private / team distribution).

| Feature | How to use |
|---------|------------|
| Syntax highlighting | Open any `.asfl` file (TextMate grammar) |
| Live diagnostics | Errors/warnings while typing (LSP, ~300 ms debounce) |
| Format Document | `Shift+Alt+F` — same pretty-printer as the library |
| Outline | Module / type / var / process / function symbols |
| Bracket pairing & folding | `language-configuration.json` |

**Install from VSIX:**

1. Download `agile-sofl-X.Y.Z.vsix` from [GitHub Releases](https://github.com/agile-sofl/agile-sofl-parser/releases) (tag `extension-vX.Y.Z`), or build locally (`npm run package --prefix packages/vscode`).
2. VS Code / Cursor: **Extensions** → **…** → **Install from VSIX…**

Details: [docs/11-VSCode扩展与LSP.md](docs/11-VSCode扩展与LSP.md).

### Demo specifications (`examples/`)

Large, parse-clean samples for trying the CLI, tests, and extension:

| File | ~Lines | Highlights |
|------|--------|------------|
| [`examples/library-system.asfl`](examples/library-system.asfl) | 127 | Multi-module library domain; `composed` records; `set`/`seq`/`map`; quantified `inv`; FSF + `others`; `decom` / `comment`; process alias |
| [`examples/ecommerce.asfl`](examples/ecommerce.asfl) | 129 | E-commerce cart/checkout; enums; `map` inventory; child modules; process alias (`equal`); multiple FSF chains |
| [`examples/hospital-registration.asfl`](examples/hospital-registration.asfl) | 138 | Hospital registration; blood-type enum; functions; emergency/billing/records submodules |

Additional test fixture:

| File | Description |
|------|-------------|
| [`tests/fixtures/integration/banking.asfl`](tests/fixtures/integration/banking.asfl) | Classic banking process with FSF, `ext`, informal `comment` — used in docs and integration tests |

Try them:

```bash
npm run build
npx asfl inspect examples/library-system.asfl
npx asfl check examples/ecommerce.asfl
npx asfl format examples/hospital-registration.asfl
```

### Quick start

```bash
git clone https://github.com/agile-sofl/agile-sofl-parser.git
cd agile-sofl-parser
npm install
npm run build
npm test
```

**Programmatic use:**

```typescript
import { parse, check, format, inspect } from '@agile-sofl/parser'

const { ast, diagnostics } = check(source)
const { source: formatted } = format(source)
const report = inspect(source, { tree: true })
```

**CLI:**

```bash
npx asfl inspect tests/fixtures/integration/banking.asfl
npx asfl check my-spec.asfl
npx asfl format my-spec.asfl
npx asfl repl    # :check, :tree, :tokens, :format, :help, :quit
```

**Build & install extension (.vsix):**

```bash
npm run build
npm run build --prefix packages/language-server
node packages/language-server/scripts/bundle.mjs
npm run package --prefix packages/vscode
# Install packages/vscode/agile-sofl-*.vsix via "Install from VSIX…"
```

**Extension development (F5, repo root):**

```bash
npm run build
npm run build --prefix packages/language-server
node packages/language-server/scripts/bundle.mjs
npm run build --prefix packages/vscode
# Press F5 in VS Code (opens examples/library-system.asfl)
```

### Documentation

| Resource | Content |
|----------|---------|
| [docs/README.md](docs/README.md) | Full Chinese doc index (grammar, FSF, API, testing) |
| [docs/11-VSCode扩展与LSP.md](docs/11-VSCode扩展与LSP.md) | Extension VSIX install, formatting rules, private release |
| [docs/08-API与CLI.md](docs/08-API与CLI.md) | API and CLI reference |

### Repository layout

```
agile-sofl-parser/
├── src/                      # Parser library source
│   ├── lexer/                  # Tokens & lexer
│   ├── parser/                 # Grammar, CST → AST
│   ├── scope/                  # Symbol tables
│   ├── typecheck/              # Type checker
│   ├── fsf/                    # FSF classifier
│   ├── transform/              # Pretty-printer (4-space indent)
│   ├── visitor/                # AST walk
│   └── cli/                    # inspect, REPL
├── packages/
│   ├── language-server/        # LSP (bundled into extension)
│   └── vscode/                 # VS Code extension (VSIX only, not Marketplace)
├── examples/                   # Demo .asfl specs
├── tests/                      # Vitest (110+ tests)
└── docs/                       # Language & tool documentation
```

### Release model

- **Parser** → npm tag `vX.Y.Z`, workflow `publish.yml`, secret `NPM_TOKEN`  
- **Extension** → private `.vsix` on GitHub Release, tag `extension-vX.Y.Z`, workflow `package-extension.yml` (no Marketplace)

Versions are **not** tied together; bump and release each product line independently.

### License

MIT — see [LICENSE](LICENSE).

---

## 中文

### 本仓库做什么

**Agile-SOFL** 是一种混形式规格语言（`.asfl` 文件），用**模块**组织常量、类型、变量、不变式、**进程**（含 FSF 场景规约）和**函数**，并支持 informal 注释。本仓库提供完整的读、分析、编辑 toolchain：

1. **词法 / 语法分析**（Chevrotain）— 源码 → 带 Span 的 AST  
2. **语义分析** — 模块作用域、符号表、类型检查  
3. **FSF 分类** — 形式 / 半形式场景判定  
4. **格式化输出** — AST → 规范文本，**4 空格语义缩进**（块关键字顶格，内容递增缩进；FSF 每场景一行）  
5. **CLI 与 REPL** — `inspect`、`check`、`format` 及交互式探索  
6. **Language Server + VS Code 扩展** — 实时诊断、格式化、大纲视图  

**npm 包**适合集成到构建脚本、Node 工具与自动化测试；**编辑器扩展**（通过 `.vsix` 手动安装）适合日常在 VS Code / Cursor 中编写规格。

### 功能一览

#### 解析器库（`@agile-sofl/parser`）

| 功能 | API / 命令 | 说明 |
|------|------------|------|
| 解析 | `parse()`、`parseModule()` | 语法 → AST；稳定诊断码 `ASFL_*` |
| 类型检查 | `check()` | 解析 + 作用域 + 类型检查 |
| FSF 分类 | `classifyFsf()` | 场景形式化程度分析 |
| 格式化 | `format()`、`printProgram()` | 4 空格语义缩进；FSF 按场景换行 |
| 检查报告 | `inspect()`、`asfl inspect` | 人类可读报告（可选 AST 树） |
| AST 访问 | `walk(ast, visitor)` | 遍历模块、类型、变量、进程、函数 |
| 规范化比较 | `normalizeAST()`、`astEqual()` | 测试与往返验证 |
| 命令行 | `asfl check`、`format`、`inspect`、`repl` | 批处理与交互 |

#### VS Code / Cursor 扩展（`packages/vscode`）

> **不上架** VS Code Marketplace，仅通过 **`.vsix` 私有/团队分发** 手动安装。

| 功能 | 用法 |
|------|------|
| 语法高亮 | 打开 `.asfl` 文件（TextMate 语法） |
| 实时诊断 | 编辑时显示错误/警告（LSP，约 300 ms 防抖） |
| 格式化文档 | `Shift+Alt+F`，与库内 pretty-printer 一致 |
| 大纲 | 模块 / 类型 / 变量 / 进程 / 函数结构 |
| 括号配对与折叠 | `language-configuration.json` |

**从 VSIX 安装：**

1. 从 [GitHub Releases](https://github.com/agile-sofl/agile-sofl-parser/releases) 下载 `agile-sofl-X.Y.Z.vsix`（标签 `extension-vX.Y.Z`），或本地打包（见下方命令）。
2. VS Code / Cursor：**扩展** → **…** → **从 VSIX 安装…**

详见 [docs/11-VSCode扩展与LSP.md](docs/11-VSCode扩展与LSP.md)。

### 示例规格（`examples/`）

可直接用于 CLI、集成测试和扩展试用的中大型 demo：

| 文件 | 约行数 | 涵盖特性 |
|------|--------|----------|
| [`examples/library-system.asfl`](examples/library-system.asfl) | 127 | 图书馆多模块；`composed` 记录类型；`set`/`seq`/`map`；量词 `inv`；FSF + `others`；`decom` / `comment`；进程别名 |
| [`examples/ecommerce.asfl`](examples/ecommerce.asfl) | 129 | 电商购物车/结算；枚举；`map` 库存；子模块；`equal` 进程别名；多条 FSF 链 |
| [`examples/hospital-registration.asfl`](examples/hospital-registration.asfl) | 138 | 医院挂号；血型枚举；函数；急诊/计费/档案子模块 |

测试夹具：

| 文件 | 说明 |
|------|------|
| [`tests/fixtures/integration/banking.asfl`](tests/fixtures/integration/banking.asfl) | 经典 Banking 进程（FSF、`ext`、informal `comment`），文档与集成测试常用 |

快速体验：

```bash
npm run build
npx asfl inspect examples/library-system.asfl
npx asfl check examples/ecommerce.asfl
npx asfl format examples/hospital-registration.asfl
```

### 快速开始

```bash
git clone https://github.com/agile-sofl/agile-sofl-parser.git
cd agile-sofl-parser
npm install
npm run build
npm test
```

**库 API：**

```typescript
import { parse, check, format, inspect } from '@agile-sofl/parser'

const { ast, diagnostics } = check(source)
const { source: formatted } = format(source)
const report = inspect(source, { tree: true })
```

**命令行：**

```bash
npx asfl inspect tests/fixtures/integration/banking.asfl
npx asfl check my-spec.asfl
npx asfl format my-spec.asfl
npx asfl repl    # :check、:tree、:tokens、:format、:help、:quit
```

**打包并安装扩展（.vsix）：**

```bash
npm run build
npm run build --prefix packages/language-server
node packages/language-server/scripts/bundle.mjs
npm run package --prefix packages/vscode
# 通过「从 VSIX 安装…」安装 packages/vscode/agile-sofl-*.vsix
```

**扩展本地开发（F5，仓库根目录）：**

```bash
npm run build
npm run build --prefix packages/language-server
node packages/language-server/scripts/bundle.mjs
npm run build --prefix packages/vscode
# VS Code 中按 F5（会打开 examples/library-system.asfl）
```

### 文档

| 资源 | 内容 |
|------|------|
| [docs/README.md](docs/README.md) | 中文文档索引（文法、FSF、API、测试） |
| [docs/11-VSCode扩展与LSP.md](docs/11-VSCode扩展与LSP.md) | 扩展 VSIX 安装、缩进格式化、私有打包发版 |
| [docs/08-API与CLI.md](docs/08-API与CLI.md) | API 与 CLI 参考 |

### 目录结构

```
agile-sofl-parser/
├── src/                      # 解析器库源码
│   ├── lexer/                  # 词法
│   ├── parser/                 # 语法、CST → AST
│   ├── scope/                  # 符号表
│   ├── typecheck/              # 类型检查
│   ├── fsf/                    # FSF 分类
│   ├── transform/              # 格式化（4 空格缩进）
│   ├── visitor/                # AST 遍历
│   └── cli/                    # inspect、REPL
├── packages/
│   ├── language-server/        # LSP（打包进扩展）
│   └── vscode/                 # VS Code 扩展（仅 VSIX，不上架商店）
├── examples/                   # Demo 规格
├── tests/                      # Vitest（110+ 测试）
└── docs/                       # 语言与工具文档
```

### 发版说明

- **解析器** → npm，标签 `vX.Y.Z`，工作流 `publish.yml`，Secret `NPM_TOKEN`  
- **扩展** → 私有 `.vsix` 上传 GitHub Release，标签 `extension-vX.Y.Z`，工作流 `package-extension.yml`（无需 Marketplace 凭据）

两条产品线**版本号独立**，互不发版绑定。

### 许可证

MIT — 见 [LICENSE](LICENSE)。
