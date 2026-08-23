# 22 — GUI 可视化设计器 handoff

本次已交付：

- `.guispec` widget `bounds` 与 `events`（向后兼容无布局的旧文件）
- 设计器画布：从控件箱拖入、移动、缩放、8px 网格
- 多 View（沿用 `screens`）切换与新建
- 运行模式：按钮 / navigation 按 `events.navigate` 或既有 `flows`/`action` 切换 View
- 与 YAML 代码 Tab 经 `useGuiModel` 双向同步
- 仅 GUI 模块选中时显示底部 GUI Views
- 设计器画布 token（`--gui-*`）定义在 `:root` / `.dark`，跟 IDE 深浅色；`GuiWireframePreview` 使用 `.gui-preview-light` 保持浅色产品皮肤


## 尚未实现、留给后续

- 锚点 / 停靠（WinForms Anchor/Dock）
- z-order 精细控制与对齐辅助线全套
- 自定义控件
- Hybrid `.asfl` `gui` 块与 `.guispec` 布局的完整双向生成
- 高保真运行时仿真（数据绑定实时原型）

设计器内核在 `packages/studio/src/renderer/components/editor/gui/GuiDesignerCanvas.vue`，导航解析在 `packages/studio/src/renderer/lib/guiNavigate.ts`。
