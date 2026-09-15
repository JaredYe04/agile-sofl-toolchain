# 19 — ASFL GUI 文法扩展

本文档定义 Hybrid Specification（`.asfl`）内可选 **精简 GUI 追踪块**，与 [18-GUI规格模块设计.md](./18-GUI规格模块设计.md) 互补。权威结构在 `.gui.html`；`.asfl` 只记录 screen → process 追踪，禁止再从 HTML 展开成扁平 widget 列表。

权威语义：*Agile-SOFL: Agile Formal Engineering Method*（Springer, 2024）Ch.4 §4.2。

## 1. 目标

- 在 `module` 内声明与过程关联的 GUI 屏追踪
- 与 `.gui.html` 的 `data-screen` / `data-process` 交叉校验
- `@agile-sofl/parser` 可解析、`check()` 可诊断；`format()` 打印精简形

## 2. 文法（EBNF）

```text
moduleBody     ::= ... invDecls? guiBlock? processFunctionSpecs
guiBlock       ::= 'gui' IDENT ';' guiScreen* 'end_gui' ';'?
guiScreen      ::= 'screen' IDENT ('triggers' IDENT ('.' IDENT)?)? ';' guiLegacy?
guiLegacy      ::= guiWidget* 'end_screen'? ';'?
guiWidget      ::= widgetKind IDENT stringLiteral widgetTrigger? ';'
widgetKind     ::= 'label' | 'button' | 'text-input' | 'navigation'
widgetTrigger  ::= 'triggers' IDENT
```

当前权威写法是单行 `screen Login triggers Auth.Login;`。旧 widget 语法仍可解析（兼容），`format()` 打印精简形。

## 3. 示例

```asfl
module SYSTEM_Trading;
gui TradingGui;
  screen Login triggers Auth.Login;
  screen Dashboard;
end_gui;
process Login (user_id: nat) ok: bool
    pre
        true
    post
        ok = true
end_process
end_module;
```

## 4. AST（`@agile-sofl/parser`）

| 节点 | 字段 |
|------|------|
| `GuiBlockNode` | `name`, `screens[]`, `span` |
| `GuiScreenNode` | `name`, `triggersProcess?`, `widgets[]`, `span` |
| `GuiWidgetNode` | `kind`, `name`, `text`, `triggersProcess?`, `span`（仅旧语法） |

`ModuleNode.gui?: GuiBlockNode`

## 5. 诊断码

| 码 | 条件 |
|----|------|
| `GUI_ASFL_001` | `gui` 块未闭合 |
| `GUI_ASFL_002` | `screen` 未闭合（旧语法） |
| `GUI_ASFL_003` | 未知 widget kind（旧语法） |
| `GUI_ASFL_004` | `triggers` 引用未知过程名（warning；支持 `Module.Proc`） |

HTML 侧 `data-process` / `data-bind` 对照 Hybrid 签名的诊断在 `@agile-sofl/gui`（见 [18](./18-GUI规格模块设计.md) §3）。

## 6. 精化映射（`@agile-sofl/aspec`）

| `.gui.html` | Hybrid |
|-------------|---------|
| `data-app` | `gui` 块名 |
| `data-screen` | `screen` 名 |
| `data-process` | `triggers` 子句 |

`buildSlimGuiBlock` / `guiBlockBuilder` 只生成 screen+triggers。`refineToAsfl` 选项 `emitGuiBlock?: boolean`。

## 7. Studio

- Hybrid `HybridGuiPanel`：只读追踪列表，跳到 `.asfl` span；布局在 GUI HTML 面板编辑
- Agent：`gui-screen` CRUD 只加精简 screen 行；页面结构走 `propose_gui_changes`
- Monaco：`gui` / `screen` / `end_gui` / `triggers`
