# 19 — ASFL GUI 文法扩展

本文档定义 Hybrid Specification（`.asfl`）内可选 **GUI 块**的文法，与 [17-Informal与Hybrid规格编辑器设计.md](./17-Informal与Hybrid规格编辑器设计.md)、[18-GUI规格模块设计.md](./18-GUI规格模块设计.md) 互补。权威语义来源：*Agile-SOFL: Agile Formal Engineering Method*（Springer, 2024）Ch.4 §4.2。

## 1. 目标

- 在 `module` 内声明与过程/数据关联的 GUI 结构
- 与 `.guispec` / `.aspec` 内嵌 `gui` 通过精化 trace 互链
- `@agile-sofl/parser` 可解析、`check()` 可诊断；Studio 可视化编辑

## 2. 文法（EBNF）

```text
moduleBody     ::= ... invDecls? guiBlock? processFunctionSpecs
guiBlock       ::= 'gui' IDENT ';' guiScreen* 'end_gui' ';'?
guiScreen      ::= 'screen' IDENT ';' guiWidget* 'end_screen' ';'?
guiWidget      ::= widgetKind IDENT stringLiteral widgetTrigger? ';'
widgetKind     ::= 'label' | 'button' | 'text-input' | 'navigation'
widgetTrigger  ::= 'triggers' IDENT
```

## 3. 示例

```asfl
module SYSTEM_Library;
type
    BookId = nat;
var
    book_ids: set of nat;
inv
    true;
gui LibraryGui;
screen Login;
    label welcome "Welcome";
    button submit "Login" triggers Borrow;
end_screen;
end_gui;
process Borrow (member_id: nat, book_id: nat) success: nat
    FSF :
    others && true
end_process
end_module;
```

## 4. AST（`@agile-sofl/parser`）

| 节点 | 字段 |
|------|------|
| `GuiBlockNode` | `name`, `screens[]`, `span` |
| `GuiScreenNode` | `name`, `widgets[]`, `span` |
| `GuiWidgetNode` | `kind`, `name`, `text`, `triggersProcess?`, `span` |

`ModuleNode.gui?: GuiBlockNode`

## 5. 诊断码

| 码 | 条件 |
|----|------|
| `GUI_ASFL_001` | `gui` 块未闭合 |
| `GUI_ASFL_002` | `screen` 未闭合 |
| `GUI_ASFL_003` | 未知 widget kind |
| `GUI_ASFL_004` | `triggers` 引用未知过程名（warning） |

## 6. 精化映射（`@agile-sofl/aspec`）

| `.guispec` / `.aspec` gui | Hybrid |
|---------------------------|--------|
| `app.name` | `gui` 块名 |
| `screens[].name` | `screen` 名 |
| `widgets[]` | `guiWidget` |
| `triggersProcess` | `triggers` 子句 |

`refineToAsfl` 选项 `emitGuiBlock?: boolean`（当 linked guispec 存在时生成骨架）。

## 7. Studio

- Hybrid `VisualEditor`：模块 overview 显示 GUI 块摘要（后续迭代）
- Monaco：`gui`/`screen`/`end_gui` TextMate 作用域（后续迭代）
- 当前：parser 附挂解析 + `check()` 诊断

## 8. 实现阶段

| 阶段 | 内容 | 状态 |
|------|------|------|
| P1 | 附挂解析器 `attachGuiBlocks` + AST + check | ✅（已由 P2 原生规则替代） |
| P2 | Chevrotain 原生规则并入 `moduleBody` | ✅ |
| P3 | LSP 补全、Studio 表单编辑 | ✅ |
