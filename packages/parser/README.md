# Agile-SOFL Parser & Editor

**English** | [中文](#中文)

Agile-SOFL is a lightweight formal specification language for describing software systems. It combines structured modules, type definitions, process specifications, FSF scenarios, and informal annotations in a single `.asfl` file.

This repository provides the complete Agile-SOFL toolchain, including:

- A parser and semantic analysis library for Node.js
- Automatic formatting and validation tools
- Command-line utilities and interactive REPL
- A Language Server implementation
- A VS Code / Cursor extension for editing `.asfl` specifications

The project is organized into two independently released components:

| Component | Package / Artifact | Description |
|------------|------------|------------|
| Parser Library | npm `@agile-sofl/parser` | Parse, analyze, validate, classify FSF scenarios, and format `.asfl` files |
| Editor Extension | Agile-SOFL (`.vsix`) | Syntax highlighting, diagnostics, formatting, outline view, and editor support |

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
4. Edit and maintain it using VS Code or Cursor

This repository implements the tooling behind that workflow.

---

## Features

### Parser Library (`@agile-sofl/parser`)

| Feature | API / Command | Description |
|----------|----------|----------|
| Parse | `parse()`, `parseModule()` | Parse source code into AST structures |
| Type Checking | `check()` | Semantic analysis and type validation |
| FSF Classification | `classifyFsf()` | Analyze formal, semi-formal, and informal scenarios |
| Formatting | `format()`, `printProgram()` | Consistent formatting with 4-space indentation |
| Inspection | `inspect()`, `asfl inspect` | Generate human-readable analysis reports |
| AST Traversal | `walk(ast, visitor)` | Visit modules, types, variables, processes, and functions |
| AST Comparison | `normalizeAST()`, `astEqual()` | Testing and round-trip validation |
| CLI | `asfl check`, `format`, `inspect`, `repl` | Batch and interactive workflows |

### VS Code / Cursor Extension

> The extension is distributed as a `.vsix` package and is not published to the VS Code Marketplace.

| Feature | Description |
|----------|----------|
| Syntax Highlighting | Language-aware highlighting for `.asfl` files |
| Live Diagnostics | Real-time syntax and semantic validation |
| Document Formatting | Uses the same formatter as the parser library |
| Outline View | Browse modules, types, variables, processes, and functions |
| Folding & Bracket Support | Editor navigation and code folding |

### Supported Tooling

- Parser and AST generation
- Semantic analysis
- Type checking
- FSF scenario classification
- Code formatting
- Command-line utilities
- Language Server Protocol (LSP)
- VS Code / Cursor integration

---

## Example Specifications

The repository includes several complete example specifications that demonstrate different language features and can be used to explore the parser, CLI, and editor support.

| File | Highlights |
|--------|--------|
| `examples/library-system.asfl` | Multi-module library management system, collections, invariants, FSF scenarios |
| `examples/ecommerce.asfl` | Shopping cart, inventory management, process aliases, nested modules |
| `examples/hospital-registration.asfl` | Registration workflows, functions, emergency and billing modules |

Additional integration example:

| File | Description |
|--------|--------|
| `tests/fixtures/integration/banking.asfl` | Banking specification used in documentation and integration tests |

Try them:

```bash
npm run build

npx asfl inspect examples/library-system.asfl
npx asfl check examples/ecommerce.asfl
npx asfl format examples/hospital-registration.asfl
```

---

## Quick Start

### Clone and Build

```bash
git clone https://github.com/agile-sofl/agile-sofl-parser.git

cd agile-sofl-parser

npm install
npm run build
npm test
```

### Using the Library

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

REPL commands:

```text
:check
:tree
:tokens
:format
:help
:quit
```

---

## Installing the VS Code Extension

Build and package the extension:

```bash
npm run build

npm run build --prefix packages/language-server

node packages/language-server/scripts/bundle.mjs

npm run package --prefix packages/vscode
```

Then install the generated `.vsix` file:

1. Open VS Code or Cursor
2. Open the Extensions view
3. Click `...`
4. Select **Install from VSIX...**
5. Choose the generated package

### Extension Development

```bash
npm run build

npm run build --prefix packages/language-server

node packages/language-server/scripts/bundle.mjs

npm run build --prefix packages/vscode
```

Press `F5` in VS Code to launch an Extension Development Host.

---

## Documentation

| Resource | Description |
|----------|----------|
| `docs/README.md` | Documentation index |
| `docs/08-API与CLI.md` | API and CLI reference |
| `docs/11-VSCode扩展与LSP.md` | Extension and LSP documentation |

---

## Repository Structure

```text
agile-sofl-parser/
├── src/
│   ├── lexer/
│   ├── parser/
│   ├── scope/
│   ├── typecheck/
│   ├── fsf/
│   ├── transform/
│   ├── visitor/
│   └── cli/
├── packages/
│   ├── language-server/
│   └── vscode/
├── examples/
├── tests/
└── docs/
```

---

## Versioning and Releases

The parser library and editor extension are released independently.

### Parser Library

- Published to npm
- Version tag format: `vX.Y.Z`

### Editor Extension

- Distributed through GitHub Releases
- Version tag format: `extension-vX.Y.Z`
- Packaged as a `.vsix` file

This allows the parser and editor to evolve on separate release schedules.

---

## License

MIT License. See [LICENSE](LICENSE).

---

# 中文

## 什么是 Agile-SOFL？

Agile-SOFL 是一种面向软件系统建模的混形式规格语言，通过结构化的方式描述系统行为与约束。

一个典型的 Agile-SOFL 规格通常包含：

- 模块（Modules）
- 常量与类型定义
- 变量与不变式
- 带前置条件和后置条件的进程（Processes）
- 函数（Functions）
- FSF 场景规格
- 非形式化说明与分解注释

通常的使用流程如下：

1. 编写 `.asfl` 规格文件
2. 使用解析器或 CLI 进行验证
3. 自动格式化规格
4. 在 VS Code 或 Cursor 中进行编辑和维护

本仓库提供了支撑上述流程的完整工具链。

---

## 功能特性

### 解析器库（`@agile-sofl/parser`）

| 功能 | API / 命令 | 说明 |
|----------|----------|----------|
| 解析 | `parse()`、`parseModule()` | 将源代码解析为 AST |
| 类型检查 | `check()` | 语义分析与类型验证 |
| FSF 分类 | `classifyFsf()` | 场景形式化程度分析 |
| 格式化 | `format()`、`printProgram()` | 统一的 4 空格缩进格式 |
| 检查报告 | `inspect()`、`asfl inspect` | 生成人类可读的分析结果 |
| AST 遍历 | `walk(ast, visitor)` | 遍历模块、类型、变量、进程与函数 |
| AST 比较 | `normalizeAST()`、`astEqual()` | 用于测试与往返验证 |
| 命令行工具 | `asfl check`、`format`、`inspect`、`repl` | 批处理与交互式使用 |

### VS Code / Cursor 扩展

> 扩展以 `.vsix` 形式发布，不上架 VS Code Marketplace。

| 功能 | 说明 |
|----------|----------|
| 语法高亮 | `.asfl` 文件语法着色 |
| 实时诊断 | 编辑过程中即时发现错误 |
| 文档格式化 | 与解析器库使用同一格式化器 |
| 大纲视图 | 浏览模块、类型、变量、进程和函数 |
| 折叠与括号支持 | 更方便的规格阅读与导航 |

### 工具链能力

- 语法解析与 AST 生成
- 语义分析
- 类型检查
- FSF 场景分类
- 自动格式化
- CLI 工具
- Language Server（LSP）
- VS Code / Cursor 编辑器支持

---

## 示例规格

仓库内提供了多个完整示例，可用于体验语言特性、CLI 工具和编辑器扩展。

| 文件 | 特性 |
|--------|--------|
| `examples/library-system.asfl` | 图书馆管理系统、多模块结构、集合类型、FSF 场景 |
| `examples/ecommerce.asfl` | 电商购物车、库存管理、进程别名、子模块 |
| `examples/hospital-registration.asfl` | 医院挂号流程、函数定义、急诊与计费模块 |

集成测试示例：

| 文件 | 说明 |
|--------|--------|
| `tests/fixtures/integration/banking.asfl` | 银行业务规格，作为文档和集成测试示例使用 |

快速体验：

```bash
npm run build

npx asfl inspect examples/library-system.asfl

npx asfl check examples/ecommerce.asfl

npx asfl format examples/hospital-registration.asfl
```

---

## 快速开始

### 克隆并构建

```bash
git clone https://github.com/agile-sofl/agile-sofl-parser.git

cd agile-sofl-parser

npm install

npm run build

npm test
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

REPL 命令：

```text
:check
:tree
:tokens
:format
:help
:quit
```

---

## 安装 VS Code 扩展

打包扩展：

```bash
npm run build

npm run build --prefix packages/language-server

node packages/language-server/scripts/bundle.mjs

npm run package --prefix packages/vscode
```

随后：

1. 打开 VS Code 或 Cursor
2. 进入扩展页面
3. 点击右上角 `...`
4. 选择“从 VSIX 安装”
5. 选择生成的 `.vsix` 文件

### 扩展开发

```bash
npm run build

npm run build --prefix packages/language-server

node packages/language-server/scripts/bundle.mjs

npm run build --prefix packages/vscode
```

在 VS Code 中按 `F5` 启动扩展调试环境。

---

## 文档

| 文档 | 内容 |
|----------|----------|
| `docs/README.md` | 文档索引 |
| `docs/08-API与CLI.md` | API 与 CLI 参考 |
| `docs/11-VSCode扩展与LSP.md` | VS Code 扩展与 LSP 说明 |

---

## 仓库结构

```text
agile-sofl-parser/
├── src/
├── packages/
│   ├── language-server/
│   └── vscode/
├── examples/
├── tests/
└── docs/
```

---

## 版本发布

解析器库与编辑器扩展采用独立发版策略。

### 解析器库

- 发布至 npm
- 标签格式：`vX.Y.Z`

### 编辑器扩展

- 通过 GitHub Releases 分发
- 标签格式：`extension-vX.Y.Z`
- 发布形式：`.vsix`

两者的版本号互不绑定，可独立演进。

---

## 许可证

MIT License，详见 [LICENSE](LICENSE)。