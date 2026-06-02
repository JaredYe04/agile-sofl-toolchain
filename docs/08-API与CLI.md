# 08 — API 与 CLI

本文档介绍 `@agile-sofl/parser` 的 **库 API** 与 **`asfl` 命令行工具**，含 `inspect` 报告样例、REPL 命令及 stdin 管道用法。

## 1. 安装与构建

```bash
npm install @agile-sofl/parser
# 开发：npm install && npm run build
```

CLI bin 名：`asfl`（`dist/cli.js`）。

## 2. 库 API

主入口 `src/index.ts`。

### 2.1 解析与检查

```typescript
import {
  parse, parseModule, check,
  parseSpecification, parseSingleModule,
  resolveScope, typeCheck, classifyFsf
} from '@agile-sofl/parser'

const { ast, diagnostics } = check(source)       // 完整流水线
const result = parse(source)                       // 仅语法 → ProgramNode
const single = parseModule(source)               // 单模块 → ModuleNode
```

`CheckResult`: `{ ast: ProgramNode | null; diagnostics: Diagnostic[] }`

分阶段调用（已有 AST）：`resolveScope(ast)` → `typeCheck(ast)` → `classifyFsf(ast)`。

### 2.2 格式化

```typescript
import { format } from '@agile-sofl/parser'
const { source: formatted, diagnostics } = format(source)
```

### 2.3 inspect 报告

```typescript
import { inspect } from '@agile-sofl/parser'

const report = inspect(source, {
  tokens: true, tree: true, fullJson: false, treeDepth: 4
})
// report.text, report.exitCode, report.ast, report.diagnostics
```

实现：`src/cli/report.ts` 的 `inspect()`。

### 2.4 遍历与定位

```typescript
import { walk, getNodeAtOffset, formatDiagnostic, DiagnosticCodes } from '@agile-sofl/parser'

walk(ast, { enterModule(mod) {}, enterProcess(p) {} })
const node = getNodeAtOffset(ast, offset)
console.log(formatDiagnostic(diag, source))
```

## 3. CLI 命令

```text
asfl inspect [file.asfl]     人类可读报告（无文件读 stdin）
asfl check  [file.asfl]      同 inspect
asfl parse  [file.asfl]      解析（--json 输出 AST）
asfl format [file.asfl]      格式化
asfl repl                    交互 REPL
asfl help                    帮助
```

| 标志 | 说明 |
|------|------|
| `--tree` | AST 摘要树 |
| `--tokens` | Token 流表 |
| `--full` | 完整 AST JSON（inspect） |
| `--json` | 原始 JSON（parse） |

```bash
npx asfl inspect tests/fixtures/integration/banking.asfl
npx asfl inspect --tree --tokens tests/fixtures/grammar/module/minimal.asfl
echo "module SYSTEM_T; end_module" | npx asfl inspect
npx asfl format myspec.asfl
npx asfl parse --json myspec.asfl
```

有 `error` 级诊断时退出码为 `1`。

## 4. inspect 报告样例

对 `minimal.asfl`（`module SYSTEM_Test; var x: nat; end_module`）：

```text
┌─ Agile-SOFL Inspect────────────────────────┐
│ Modules: 1  Processes: 0  Functions: 0   │
│ ✓ parse  ⚠ 0 warnings  ✗ 0 errors        │
└────────────────────────────────────────────┘

Module SYSTEM_Test
  var:   x

No diagnostics.
```

对 `banking.asfl`：

```text
┌─ Agile-SOFL Inspect────────────────────────┐
│ Modules: 1  Processes: 1  Functions: 0     │
│ ✓ parse  ⚠ 0 warnings  ✗ 0 errors          │
└────────────────────────────────────────────┘

Module SYSTEM_Banking
  const: withdraw_limit, transfer_limit
  type:  Customers, A
  var:   salary, customers
  inv:   1 predicate(s)
  process A
    ext: rd a, wr b
    FSF scenarios:
      [1] x > y && q1 > q2 + q3  =>  x = y && q1 > q2 * q3
      others     =>  q1 = q2 + q3
    decom: Banking_Decom
    comment: informal note

No diagnostics.
```

`--tree` 追加 AST 摘要；`--tokens` 追加 Token 表（Type / Image / Loc 列）。

错误时末尾列出诊断：

```text
Diagnostics
  [error] ASFL_PARSE_001 @ 1:1
  Expecting token of type --> EndModule <-- but found --> <EOF> <--
    module broken
    ^
```

## 5. REPL

```bash
npx asfl repl
```

实现：`src/cli/repl.ts` 的 `runRepl()`。

**输入模式**：多行缓冲（空行或 `:end` 触发检查）；或 `:check <one-liner>` 单行。

| 命令 | 说明 |
|------|------|
| `:check` | parse + 语义报告 |
| `:tree` | 含 AST 摘要树 |
| `:tokens` | 含 Token 流 |
| `:format` | 格式化缓冲/inline 源码 |
| `:clear` | 清空缓冲 |
| `:help` | 帮助 |
| `:quit` / `:q` | 退出 |
| `:end` | 检查当前缓冲 |

```text
asfl> module SYSTEM_Demo;
asfl> var n: nat;
asfl> end_module
asfl>                          ← 空行触发 :check，输出 inspect 报告
asfl> :tree :check module SYSTEM_T; end_module
asfl> :format module SYSTEM_T; var x:nat; end_module
asfl> :quit
Bye.
```

## 6. stdin 管道

无文件参数且 stdin 非 TTY 时从标准输入读取（`src/cli.ts` → `readStdin()`）。

```bash
cat spec.asfl | npx asfl check
echo 'module SYSTEM_T; end_module' | npx asfl inspect --tree
```

无输入时报错：`Usage: asfl inspect [file.asfl]  (or pipe stdin)`，退出码 `1`。

## 7. 集成与导出类型

CI：`npx asfl check specs/main.asfl`（依赖 exit code）。脚本中 `check(readFileSync(...))` 过滤 `severity === 'error'` 即可。

主要导出类型：`ProgramNode`, `ModuleNode`, `Diagnostic`, `Span`, `CheckResult`, `FormatResult`, `InspectReport`, `ScopeResult`, `SymbolEntry`, `Visitor`。完整定义见 `dist/index.d.ts`。
