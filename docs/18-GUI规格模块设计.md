# 18 — GUI 规格模块设计

本文档是 **GUI 规格模块**的权威设计，与 [17-Informal与Hybrid规格编辑器设计.md](./17-Informal与Hybrid规格编辑器设计.md) 互补。GUI 规格描述页面、控件与用户动作，比 FSF 更非形式；**不扩展 ASFL 文法**，经 trace 与 informal process/data 关联。

## 1. 目标与范围

| 术语 | 含义 |
|------|------|
| **GUI Specification** | 页面/控件/导航流的非形式描述，存于 `.guispec` 或 `.aspec` 内嵌 `gui` 块 |
| **Screen** | 一个 UI 页面或视图 |
| **Widget** | 页面内控件（输入、按钮、列表等） |
| **Flow** | 屏幕间导航关系 |

**范围**

- `@agile-sofl/gui`：parse、validate、patch、buildGuiModel、trace/coverage 扩展
- Studio：GuiVisualEditor + Cursor 风格线框预览（[awesome-design-md Cursor](https://github.com/VoltAgent/awesome-design-md)）
- 双存储：独立 `.guispec` + `.aspec` 内嵌 / `meta.guiTarget` 互链

**不在范围**：ASFL `gui` 文法、精化生成 hybrid GUI、可交互原型。

## 2. 文件格式

### 2.1 独立 `.guispec`

见 `examples/library-gui.guispec`；Schema：`packages/gui/schema/guispec-v1.schema.json`。

### 2.2 `.aspec` 内嵌

顶层可选 `gui:` 块（与 `modules` 并列）；`meta.guiTarget` 指向外部 `.guispec`。

合并策略（`mergeGuiSources`）：同 id 时 **external 优先**。

### 2.3 Widget kinds（MVP）

`label` | `text-input` | `button` | `checkbox` | `select` | `list` | `table` | `section` | `navigation`

### 2.4 绑定

- `binds.param` — 关联 informal 过程参数字段名
- `binds.variable` — 关联 aspec variable id
- `binds.display` — 只读展示字段

## 3. 诊断码

| 码 | 条件 |
|----|------|
| `GUI_SCHEMA_001` | 结构/schema 错误 |
| `GUI_STYLE_001` | screen 无 widgets 且无 description |
| `GUI_STYLE_002` | triggersProcess 在 linked informal 中不存在 |
| `GUI_STYLE_003` | flow 引用未知 screen |
| `GUI_STYLE_004` | 重复 id |

## 4. IPC（Studio）

| Channel | 说明 |
|---------|------|
| `studio:build-gui-model` | 构建 GuiDocumentModel |
| `studio:patch-gui` | patch 写回 YAML |
| `studio:format-gui` | canonical serialize |
| `studio:resolve-gui-for-aspec` | 合并 embedded + external |

## 5. Cursor 设计规约（预览区）

GUI 线框预览使用 warm cream 画布、hairline 边框、Cursor Orange 主按钮；详见 [packages/studio/DESIGN.md](../packages/studio/DESIGN.md) §8。Shell IDE 区保持现有 VS Code 蓝 accent。

## 6. Trace / Coverage

- Trace link kind：`gui-screen` | `gui-widget`
- Screen covered：当 `triggersProcess` 对应 process 在 hybrid 中 covered
