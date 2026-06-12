# FSF 规约

**FSF**（Formal / Semi-Formal specification）描述过程/函数行为：将 **Test**（场景条件）与 **Def**（输出约束）组成场景列表，并以 `others` 覆盖剩余输入。本文说明语法、形式/半形式判定，及 `ext`、`decom`、`comment`。

---

## 1. 语法结构

```ebnf
fsfSpec       ::= fsfExpression [ "||" "others" "&&" predicate ]
                  | "others" "&&" predicate
fsfExpression ::= fsfScenario { "||" fsfScenario }
fsfScenario   ::= predicate "&&" predicate
```

以 `FSF :` 引导。每个场景 **`Test && Def`**；场景间 **`||`**；末尾推荐 **`|| others && Def`**。

```asfl
FSF :
条件1 && 定义1 ||
条件2 && 定义2 ||
others && 默认定义
```

- **`&&`**：场景内 Test 与 Def  
- **`||`**：分隔场景（`others` 前最后一个 `||` 除外）  
- **`others`**：兜底分支  

**仅 others**（合法）：

```asfl
process P ()
FSF :
others && true
end_process
```

无 `others` 时分类器可能提示不完整，生产规格建议始终写出兜底分支。

---

## 2. Test 与 Def

| 侧 | 内容 |
|----|------|
| Test | 输入关系、状态谓词、量词 |
| Def | 输出与输入/表达式的等式或不等式 |

**Banking 示例**：

```asfl
process A (x, y: int) q1: nat, q2: int, q3: int
FSF :
x > y && q1 > q2 + q3 ||
x = y && q1 > q2 * q3 ||
others && q1 = q2 + q3
end_process
```

Test/Def 使用 **predicate**（`and`/`or`、关系式、量词），**不是** FSF 级 `&&`/`||`。

---

## 3. 形式 vs 半形式

**形式**：所有原子谓词为关系式、布尔值、量词、`not`、`bound`、`subset`、`is_*` 等，无 informal 文本。

**半形式**：存在 **informal text** 原子（连续标识符或含字符串短语）：

```asfl
FSF :
informal requirement && y = 1
```

**分类器规则**：

| 层次 | 条件 | 结果 |
|------|------|------|
| 底层（无 `decom`） | 半形式 | 警告 |
| 非底层（有 `decom`） | 形式且无 `comment` | info：通常半形式 |
| 任意 | 无 `others` | info：可能不完整 |

---

## 4. `ext`、`decom`、`comment`

```asfl
process Name (inputs) outputs
ext
rd a: int
wr b: nat
FSF :
…
decom: Banking_Decom
comment: informal note
end_process
```

**`ext`**：`rd` 只读、`wr` 可写外部变量；类型可选。

**`decom`**：分解/精化图标识符；**有 decom 即为非底层**，FSF 可半形式。

**`comment`**：自然语言说明。`text` 可包含：ASCII 标识符、引号字符串、数字、以及**无引号中文等非 ASCII 词**（词之间以空格分隔，与 `informal note here` 相同）。

```asfl
process P ()
FSF :
true && true
decom: RefinementDiagram
comment: informal note here
end_process
```

---

## 5. 函数 FSF 与过程别名

```asfl
function fee (amount: nat): nat
FSF :
amount > 0 && fee = amount div 100
== if amount > 1000 then amount div 50 else amount div 100
end_function

function g (x: nat): bool == undefined
end_function
```

过程别名（无 FSF 体），关键字 **`equal`**：

```asfl
process Copy equal Other.P
end_process
```

双参数列表：`(a, b: int) c: nat, d: int` — 括号内输入，括号后输出；FSF 可直接引用参数名与模块变量。

---

## 6. 检查清单与验证

1. 每场景是否 `Test && Def` 成对？  
2. 场景分隔是否用 `||`（非 `or`）？  
3. 是否有 `others && …`？  
4. 底层是否全形式化？非底层是否配 `decom`/`comment`？  

完整示例：

```asfl
module SYSTEM_Demo;
process Transfer (amt: nat) ok: bool
ext
rd balance: nat
wr balance: nat
FSF :
amt > 0 && amt <= balance && ok = true ||
others && ok = false
decom: Transfer_Refinement
comment: 半形式说明可写在此
end_process
end_module
```

```bash
npx asfl check fsf-demo.asfl
npx asfl inspect --tree fsf-demo.asfl
```

相关：[02-语言概览.md](./02-语言概览.md)、[04-类型与表达式.md](./04-类型与表达式.md)。
