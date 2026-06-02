# 06 — 解析器与 AST 设计

本文档说明 `@agile-sofl/parser` 从源码到 AST 的完整流水线、节点模型、位置信息（Span）以及面向库使用者的诊断码约定。

## 1. 处理流水线

Agile-SOFL 规格的处理分为六个阶段，由库入口函数串联：

```
源码 (string)
  │
  ▼ lex ───────────── Chevrotain Lexer（AgileSoflLexer）
  │                    产出 Token 流；词法错误 → ASFL_LEX_001
  ▼ parse ─────────── Chevrotain Parser（parserInstance）
  │                    产出 CST（具体语法树）
  ▼ cstToAst ──────── cstToProgram / cstToModuleAst
  │                    产出带 Span 的 AST
  ▼ resolveScope ──── 模块树 + 符号表
  │                    重复模块名等 → ASFL_SCOPE_*
  ▼ typeCheck ─────── 变量/参数/函数返回类型检查
  │                    类型不匹配 → ASFL_TYPE_*
  ▼ classifyFsf ───── 形式/半形式 FSF 分类
                       规约风格提示 → ASFL_FSF_*
```

### 1.1 入口函数对照

| 函数 | 文件 | 说明 |
|------|------|------|
| `parse(source)` | `src/parser/parse.ts` | 解析完整规格（多模块 `program`） |
| `parseModule(source)` | 同上 | 单模块模式，返回 `module` 节点 |
| `parseSpecification(source)` | `src/index.ts` | 完整流水线，返回 `CheckResult` |
| `check(source)` | 同上 | `parseSpecification` 的别名 |
| `parseSingleModule(source)` | 同上 | 单模块 + 包装为 `program` 后走语义阶段 |

语义阶段仅在**解析无 error 级诊断**时执行（见 `parseSpecification` 与 `inspect` 中的守卫逻辑）。

### 1.2 实现文件地图

| 阶段 | 主要文件 |
|------|----------|
| 词法 | `src/lexer/tokens.ts`, `src/lexer/lexer.ts` |
| 语法 | `src/parser/parser.ts` |
| CST→AST | `src/parser/cstToAst.ts` |
| AST 定义 | `src/ast/nodes.ts`, `src/ast/span.ts` |
| 诊断 | `src/diagnostics/codes.ts` |
| 访问器 | `src/visitor/walk.ts` |

## 2. AST 设计原则

AST 采用**可辨识联合类型**（discriminated union）：每个节点都有 `type` 字段，且携带 `span: Span`，便于编辑器/LSP 按偏移定位。

顶层结构：

```
ProgramNode
└── modules: ModuleNode[]
    ├── consts, types, vars, invariants
    ├── processes: ProcessNode[]
    └── functions: FunctionNode[]
```

### 2.1 核心节点表

| `type` 字段 | 接口名 | 主要字段 | 用途 |
|-------------|--------|----------|------|
| `program` | `ProgramNode` | `modules`, `trailingDot?` | 多模块规格根 |
| `module` | `ModuleNode` | `name`, `isSystem`, `parent?`, 各声明列表 | 单模块 |
| `qualified_name` | `QualifiedNameNode` | `module?`, `name` | 限定名（如 `R.Base`） |
| `const_decl` | `ConstDeclNode` | `name`, `value` | 常量 |
| `type_decl` | `TypeDeclNode` | `name`, `parentType?`, `typeExpr` | 类型别名 |
| `var_decl` | `VarDeclNode` | `variable`, `typeExpr` | 模块变量 |
| `variable` | `VariableNode` | `kind`, `name` | `normal` / `ext` / `ext_hash` |
| `invariant` | `InvariantNode` | `condition` | 不变式谓词 |
| `process` | `ProcessNode` | `inputs`, `outputs`, `body?`, `alias?` | 进程 |
| `process_body` | `ProcessBodyNode` | `ext`, `fsf?`, `decomposition?`, `comment?` | 进程体 |
| `ext_var` | `ExtVarNode` | `access`, `name`, `typeExpr?` | 外部变量 `rd`/`wr` |
| `function` | `FunctionNode` | `params`, `returnType`, `fsf?`, `body?` | 函数 |
| `fsf_spec` | `FsfSpecNode` | `scenarios`, `others?` | FSF 规约块 |
| `fsf_scenario` | `FsfScenarioNode` | `test`, `def` | 单条场景 `test => def` |
| `predicate` | `PredicateNode` | `disjuncts` | DNF 谓词（析取） |
| `conjunction` | `ConjunctionNode` | `atoms` | 合取子句 |
| `informal_text` | `InformalTextNode` | `text` | 非形式自然语言片段 |
| `quantified` | `QuantifiedNode` | `quantifier`, `bindings`, `body` | 量词谓词 |
| `relational_expr` | `RelationalExprNode` | `kind`, `left`, `right` | 关系/集合成员谓词 |

类型表达式（`TypeExprNode`）包括：`basic_type`, `named_type`, `enum_type`, `set_type`, `seq_type`, `composed_type`, `product_type`, `map_type`, `union_type`。

表达式（`ExpressionNode`）包括：`identifier`, `binary_op`, `call`, `if_expr`, `let_expr`, `case_expr`, `set_expr`, `seq_expr`, `map_expr`, `mk_expr`, `modify_expr` 等二十余种。

### 2.2 类型守卫

`src/ast/guards.ts` 提供 `isProgramNode`, `isModuleNode`, `isInformalText` 等守卫，供测试与工具链安全收窄类型。

## 3. Span（源码位置）

```typescript
interface Span {
  start: number   // 0-based 字符偏移（含）
  end: number     // 0-based 字符偏移（含）
  line: number    // 1-based 行号
  column: number  // 1-based 列号
}
```

- 每个 AST 节点均含 `span`，由 `cstToAst` 从 Chevrotain Token 偏移合并生成。
- `mergeSpans(a, b)` 用于合并子节点范围。
- `EMPTY_SPAN` 用于无法定位的内部错误。
- `getNodeAtOffset(ast, offset)`（`src/visitor/walk.ts`）按偏移查找最内层节点，供编辑器悬停/跳转使用。

## 4. InformalText（非形式文本）

Hybrid 规格允许在 FSF 谓词中嵌入自然语言。解析器将其建模为独立节点：

```typescript
interface InformalTextNode {
  type: 'informal_text'
  text: string
  span: Span
}
```

`informal_text` 作为 `AtomicPredicateNode` 的一种，出现在 `predicate.disjuncts[].atoms[]` 中。FSF 分类器通过 `isInformalText(atom)` 判定该原子是否为非形式——若底层进程（无 `decomposition`）的 FSF 含非形式文本，则报告 `ASFL_FSF_001`。

## 5. 诊断码（库使用者参考）

所有诊断均为 `Diagnostic` 对象：

```typescript
interface Diagnostic {
  code: string
  message: string
  severity: 'error' | 'warning' | 'info'
  span: Span
}
```

### 5.1 完整码表

| 代码 | 常量名 | 严重级别 | 触发阶段 | 含义 |
|------|--------|----------|----------|------|
| `ASFL_PARSE_001` | `PARSE_ERROR` | error | parse | 语法错误或 CST→AST 转换失败 |
| `ASFL_LEX_001` | `LEX_ERROR` | error | lex | 非法字符、未闭合字符串等 |
| `ASFL_SCOPE_001` | `UNDEFINED_SYMBOL` | error | scope | 未定义符号（预留） |
| `ASFL_SCOPE_002` | `DUPLICATE_SYMBOL` | error | scope | 重复模块名 |
| `ASFL_SCOPE_003` | `PARENT_VAR_WRITE` | error | scope | 跨模块写入父模块变量 |
| `ASFL_TYPE_001` | `TYPE_MISMATCH` | error | typecheck | 类型不兼容 |
| `ASFL_TYPE_002` | `UNKNOWN_TYPE` | error | typecheck | 未知类型名 |
| `ASFL_TYPE_003` | `INVALID_BUILTIN` | error | typecheck | 非法内建函数 |
| `ASFL_FSF_001` | `FSF_INFORMAL_BOTTOM` | warning | fsf | 底层进程使用非形式 FSF |
| `ASFL_FSF_002` | `FSF_FORMAL_NON_BOTTOM` | info | fsf | 非底层进程使用纯形式 FSF |
| `ASFL_FSF_003` | `FSF_MISSING_OTHERS` | info | fsf | 缺少 `others &&` 分支 |

### 5.2 库内使用示例

```typescript
import { check, formatDiagnostic, DiagnosticCodes } from '@agile-sofl/parser'

const { ast, diagnostics } = check(source)

const errors = diagnostics.filter(d => d.severity === 'error')
const dupModules = diagnostics.filter(
  d => d.code === DiagnosticCodes.DUPLICATE_SYMBOL
)

for (const d of diagnostics) {
  console.log(formatDiagnostic(d, source))
}
```

按 `code` 前缀过滤：`ASFL_SCOPE_*`、`ASFL_TYPE_*`、`ASFL_FSF_*` 可分别对应符号、类型、规约风格三类问题。

## 6. 辅助变换

| 函数 | 文件 | 说明 |
|------|------|------|
| `printProgram(ast)` | `src/transform/print.ts` | AST → 格式化源码 |
| `normalizeAST` / `stripSpans` | `src/transform/normalize.ts` | 测试用 AST 规范化 |
| `astEqual(a, b)` | 同上 | 忽略 Span 的结构相等比较 |
| `walk(ast, visitor)` | `src/visitor/walk.ts` | 访问 program/module/process/function/expression |

## 7. 设计要点小结

1. **CST 与 AST 分离**：Chevrotain 负责语法；`cstToAst.ts` 负责语义化树结构，便于独立演进。
2. **Span 一等公民**：自解析阶段起即附着，贯穿诊断与编辑器 API。
3. **InformalText 显式建模**：不将自然语言混入字符串字面量，FSF 分类可精确判定。
4. **稳定诊断码**：`ASFL_*` 前缀便于 CI、IDE 插件与下游工具按码分流处理。
5. **渐进式检查**：解析失败时不运行后续语义阶段，避免级联误报。
