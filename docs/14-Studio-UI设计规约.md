# 14 — Studio UI 设计规约

Agile-SOFL Studio（Electron + Vue）Phase 1/2 统一 UI 契约。实现时以本规约为准，与 [12-Electron编辑器集成.md](./12-Electron编辑器集成.md) 架构文档互补。

## 1. 设计原则

- **现代 IDE 风格**：参考 Cursor / VS Code 信息密度，但更轻、圆角更明显。
- **8px 网格**：间距使用 4/8/12/16/24px 倍数。
- **圆角**：面板 `rounded-lg`（8px），按钮/输入 `rounded-md`（6px），下拉 `rounded-lg`。
- **分隔**：1px 低对比边框 `border-border-subtle`，避免重阴影。
- **无边框窗口**：不使用 Electron 原生菜单栏与系统标题栏；自绘顶栏 + 窗口控件。

## 2. 色彩 Token

Shell UI 使用 CSS 变量（定义于 `packages/studio/src/renderer/styles/main.css`），Tailwind 通过 `theme.extend.colors` 映射。

| Token | 浅色 | 深色 | 用途 |
|-------|------|------|------|
| `--surface-base` | `#f3f3f3` | `#1e1e1e` | 窗口背景 |
| `--surface-raised` | `#ffffff` | `#252526` | 顶栏、Tab、面板 |
| `--surface-overlay` | `#ffffff` | `#2d2d2d` | 下拉、模态 |
| `--text-primary` | `#1e1e1e` | `#cccccc` | 主文字 |
| `--text-secondary` | `#616161` | `#858585` | 次要文字 |
| `--text-muted` | `#8b8b8b` | `#6e6e6e` | 占位符 |
| `--accent` | `#0078d4` | `#3794ff` | 焦点、链接 |
| `--border-subtle` | `#e5e5e5` | `#3c3c3c` | 分隔线 |
| `--danger` | `#e81123` | `#f14c4c` | 关闭按钮 hover |

Monaco 主题 `agile-sofl-light` / `agile-sofl-dark` 与上述 token 对齐；语法色来自 VS Code `tokenColors` 映射。

## 3. 顶栏（TitleBar）

- **高度**：35px（`h-[35px]`）。
- **布局**：三区 flex — 左（菜单 + 可选工具）、中（Command Center）、右（扩展区 + WCO）。
- **拖拽**：空白区域 `-webkit-app-region: drag`；按钮、菜单、输入为 `no-drag`（`-webkit-app-region: no-drag`）。
- **macOS**：左侧预留交通灯安全区（`pl-[78px]` 当 `platform === darwin`）。
- **窗口控件（WCO）**：最小化、最大化/还原、关闭；hover 背景过渡；关闭 hover 使用 `--danger`。

## 4. 动效

| 交互 | 规范 |
|------|------|
| 按钮 hover | `transition-colors duration-150` |
| 按钮 active | `active:scale-[0.98] duration-100` |
| 菜单展开 | `opacity 0→1` + `translateY -4px→0`，150–200ms，`ease-out` |
| Tab 切换 | 背景色 150ms，无位移动画 |
| 禁止 | 超过 300ms 的动画、弹跳 easing |

## 5. 组件清单（Phase 1）

| 组件 | 路径 | 职责 |
|------|------|------|
| `TitleBar` | `components/chrome/TitleBar.vue` | 顶栏容器 |
| `MenuBar` | `components/chrome/MenuBar.vue` | File / Edit / View / Help |
| `CommandCenter` | `components/chrome/CommandCenter.vue` | 搜索占位 + 活动文档标题 |
| `WindowControls` | `components/chrome/WindowControls.vue` | 最小化 / 最大化 / 关闭 |
| `EditorTabs` | `components/editor/EditorTabs.vue` | 多 Tab + 未保存 `●` |
| `MonacoEditor` | `components/editor/MonacoEditor.vue` | Monaco 实例与 model |
| `StatusBar` | `components/editor/StatusBar.vue` | 路径、诊断、LSP、语言 |
| `DropdownMenu` | `components/ui/DropdownMenu.vue` | 菜单下拉 |
| `Modal` | `components/ui/Modal.vue` | 未保存确认等 |

## 6. i18n Key 命名

- 扁平命名空间：`menu.file.new`、`menu.edit.undo`、`window.minimize`。
- 对话框：`dialog.unsaved.title`、`dialog.unsaved.save`。
- 状态栏：`status.lsp.connected`、`status.errors`。
- 默认语言：简体中文（`zh-CN`）；备选 English（`en`）。

## 7. 无障碍与快捷键

- 菜单项 `role="menuitem"`，下拉 `role="menu"`。
- 顶栏菜单 Alt+字母（如 Alt+F File）。
- 焦点环：`focus-visible:ring-2 focus-visible:ring-accent/50`。
- 全局快捷键见 `MenuBar` 与 `documentStore` 注册表。

## 8. Phase 2 预留

- 侧边栏（文件树、大纲）宽度 240–280px，可折叠。
- 可视化面板与 Monaco 分屏；块 UI 使用相同 token，不引入第二套色板。
