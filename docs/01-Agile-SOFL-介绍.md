# Agile-SOFL 介绍

Agile-SOFL 是一种面向软件规格说明的**混合形式化语言**：在经典 SOFL（Structured Object-Oriented Formal Language）的模块—过程—数据模型之上，引入 **FSF（Formal/Semi-Formal）场景规约**，使开发团队可以在同一套语法中交替使用严格谓词与自然语言片段，从而支持自顶向下精化与敏捷迭代并存的工作方式。

本仓库 `@agile-sofl/parser` 提供该语言的词法分析、语法分析、AST、作用域解析、类型检查、FSF 形式/半形式分类以及格式化输出。下文介绍语言动机与典型开发流程；具体语法见后续文档。

---

## 1. 为什么需要混合规格

传统形式化方法要求每一层规约均为完全可判定的逻辑公式，学习曲线陡峭，且早期需求往往以自然语言存在。纯自然语言规格则缺乏可机械检查的结构，难以保证精化前后一致。

Agile-SOFL 的折中策略：

| 层次 | 典型写法 | 工具期望 |
|------|----------|----------|
| 顶层 / 中间层 | 半形式 FSF：场景条件 + 自然语言或谓词混合 | 结构完整，允许 `informal text` 原子谓词 |
| 底层（无 `decom`） | 形式 FSF：全部为可解析谓词与表达式 | 类型检查与 FSF 分类器要求形式化 |
| 不变式、函数体 | 谓词或 `==` 定义的表达式 | 可静态分析 |

这样既保留 SOFL 模块化与数据精化的纪律，又允许在需求尚未完全形式化时先写入规格，再逐步替换为谓词。

---

## 2. 与经典 SOFL 的关系

Agile-SOFL **继承**经典 SOFL 的核心概念：

- **模块（module）**：封装常量、类型、变量、不变式、过程与函数。
- **过程（process）**：带输入/输出参数的可精化行为单元；通过 FSF 描述输入—输出关系。
- **变量与不变式（var / inv）**：模块级状态及应始终成立的约束。
- **层次结构**：系统模块 `SYSTEM_Name` 与子模块 `Child / Parent` 构成精化树。

**扩展与差异**（本解析器已实现）：

- FSF 采用 `条件 && 定义 || … || others && 定义` 的场景列表语法。
- 过程别名：`process Copy equal Other.P`（关键字为 `equal`，非 `=`）。
- 枚举值写作尖括号：`<red>`、`<green>`。
- 积类型用 `*`，并类型用 `|`：`nat * int`、`nat | int`。
- 函数可写 `== undefined` 表示尚未实现。

经典 SOFL 工具链与本解析器 API 不兼容；`.asfl` 文件面向 Agile-SOFL 文法。

---

## 3. 形式与半形式规约

**形式（formal）**：FSF 中每个场景的条件（Test）与定义（Def），以及 `others` 分支，均由可解析的谓词组成——关系式、布尔联结、量词、`bound(...)` 等。不含连续标识符/字符串组成的「非正式文本」原子。

**半形式（semi-formal）**：至少一个原子谓词被解析为 `informal_text`（例如连续两个标识符或含字符串片段的短语）。常见于带 `decom` 的非底层过程，配合 `comment:` 段说明设计意图。

解析器中的 FSF 分类器会给出提示，例如：底层过程使用半形式 FSF 时警告；非底层过程仅有形式 FSF 且无 `comment` 时提示通常应为半形式。

---

## 4. 典型开发流程

推荐自顶向下的精化顺序：

```text
系统模块 (SYSTEM_*)
    → 子模块 (/ 父模块)
        → 过程签名 + FSF 场景
            → decom 指向更细模块/图
                → 底层过程：形式 FSF
                    → 函数定义 (function … == …)
```

### 4.1 模块

先建立系统边界与共享类型：

```asfl
module SYSTEM_Ordering;
type OrderId = nat;
type Status = {<pending>, <shipped>, <done>};
var orders: set of OrderId;
end_module
```

### 4.2 过程与 FSF

在模块内声明过程，用 FSF 列出场景：

```asfl
module SYSTEM_Ordering;
process Submit (req: int) ack: nat
FSF :
req > 0 && ack = req + 1 ||
others && ack = 0
end_process
end_module
```

### 4.3 精化（decom）

非底层过程可指向分解图或子规格名：

```asfl
process Submit (req: int) ack: nat
FSF :
req > 0 && ack > 0
decom: Submit_Refinement
comment: 详细步骤见分解图
end_process
```

### 4.4 过程别名

复用已有过程定义，避免重复 FSF：

```asfl
module SYSTEM_A;
process Copy equal Other.P
end_process
end_module;
module Other / A;
process P ()
FSF :
true && true
end_process
end_module
```

### 4.5 函数

将可计算片段抽为函数，便于类型检查与重用：

```asfl
function max (a: nat, b: nat): nat
== if a > b then a else b
end_function
```

---

## 5. 工具链一览

安装并构建后，可用 CLI 检查规格：

```bash
npm install && npm run build
npx asfl inspect tests/fixtures/integration/banking.asfl
npx asfl check my-spec.asfl
npx asfl parse --json my-spec.asfl
npx asfl format my-spec.asfl
npx asfl repl
```

| 命令 | 作用 |
|------|------|
| `inspect` / `check` | 词法、语法、作用域、类型、FSF 分类的综合报告 |
| `parse` | 输出 AST（可选 `--json`、`--tree`） |
| `format` | 规范化排版 |
| `repl` | 交互式输入片段并解析 |

TypeScript API：`parse`、`check`、`format` 等从 `@agile-sofl/parser` 导出。

---

## 6. 文档阅读顺序

1. **本文** — 背景与流程  
2. [02-语言概览.md](./02-语言概览.md) — 规格各段与 Banking 完整示例  
3. [03-文法参考.md](./03-文法参考.md) — EBNF 与词法  
4. [04-类型与表达式.md](./04-类型与表达式.md) — 类型系统与表达式  
5. [05-FSF-规约.md](./05-FSF-规约.md) — 场景规约详解  

建议将 `tests/fixtures/integration/banking.asfl` 作为第一个可运行的完整样例，配合 `asfl inspect` 对照 AST 与诊断信息学习。
