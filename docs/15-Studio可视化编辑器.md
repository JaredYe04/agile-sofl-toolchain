# 15 — Studio 可视化编辑器

Agile-SOFL Studio 可视化编辑架构与同步协议。与 [12-Electron编辑器集成.md](./12-Electron编辑器集成.md)、[14-Studio-UI设计规约.md](./14-Studio-UI设计规约.md) 互补。

## 1. 设计原则

- **单一事实来源**：`.asfl` 文本存于 Pinia `document` store；Monaco 与可视化面板均为视图。
- **派生模型**：可视化 UI 消费 `@agile-sofl/editor-api` 的 JSON DTO，不直接突变 AST。
- **Patch 写回**：可视化编辑通过 `patchFsfSpec`、`patchComment`、`patchDecom`、`patchDeclaration` 等函数生成新文本。
- **实时同步**：代码变更 debounce 300ms 后重建 DTO；可视化 patch 立即写回 store 并更新 Monaco model。

## 2. 数据流

```mermaid
flowchart LR
  Text[DocumentStore.content]
  Parse[checkIncremental]
  DTO[VisualModel DTOs]
  Patch[patch APIs]
  Monaco[MonacoEditor]
  Visual[VisualEditor]
  Text -->|debounce| Parse --> DTO --> Visual
  Visual -->|patch| Patch --> Text
  Text --> Monaco
```

## 3. VisualModel DTO

| 字段 | 来源 | 用途 |
|------|------|------|
| `documentModel` | `buildDocumentModel` | 模块列表、诊断计数 |
| `moduleGraph` | `buildModuleGraph` | 模块关系图导航 |
| `fsfModels` | `buildAllFsfModels` | FSF 场景表单 |
| `modules[].consts/types/vars` | AST + `sliceText` | 声明表单（含 `text`/`span`） |
| `parseFailed` | `buildVisualModelTolerant` | 仅当完全无 `ProgramNode` 时为 true |
| `hasDiagnostics` | 同上 | 存在 error 级诊断（不阻断树/图浏览） |

## 4. 组件结构（Phase 2b）

| 组件 | 路径 | 职责 |
|------|------|------|
| `VisualEditor` | `components/editor/visual/VisualEditor.vue` | 根容器 |
| `VisualToolbar` | `components/editor/visual/VisualToolbar.vue` | 独立工具栏：刷新、应用、添加声明/场景、树/图切换 |
| `ModuleTree` | `components/editor/visual/ModuleTree.vue` | 模块/进程/函数树 |
| `ModuleGraphView` | `components/editor/visual/ModuleGraphView.vue` | SVG 关系图导航 |
| `ModuleOverview` | `components/editor/visual/ModuleOverview.vue` | const/type/var 可编辑表单 |
| `DeclarationEditor` | `components/editor/visual/DeclarationEditor.vue` | 声明 CRUD 表格 |
| `ProcessEditor` | `components/editor/visual/ProcessEditor.vue` | decom/comment/FSF |
| `FunctionOverview` | `components/editor/visual/FunctionOverview.vue` | 函数签名只读 |
| `FsfScenarioEditor` | `components/editor/visual/FsfScenarioEditor.vue` | FSF 场景表格 |
| `ParseErrorBanner` | `components/editor/visual/ParseErrorBanner.vue` | 解析错误提示 |

Composable：`composables/useVisualModel.ts` — debounced parse、patch 循环防护、`rebuildNow()`、`patchDeclaration()`。

## 5. 同步协议

### 代码 → 可视化

1. 监听 `activeTab.content`
2. 300ms debounce 后调用 `checkIncremental(source, state)`
3. 重建 `ast`、`documentModel`、`fsfModels`、声明 DTO

### 可视化 → 代码

1. 用户编辑 FSF / decom / comment / 声明
2. 调用对应 `patchXxx(source, ...)` 得到新文本
3. `document.setContent(tabId, newSource)` 标记 dirty
4. Monaco watch 同步 model；`skipNextParse` 避免重复 parse

## 6. 视图模式

默认 **双栏**（`split`）：左 Monaco、右 VisualEditor。工具栏顺序：双栏 / 代码 / 可视化。

- **代码工具栏**：小地图、行号、格式化（`Shift+Alt+F` 或 Edit 菜单）
- **可视化工具栏**：刷新、全部应用、添加声明、树/关系图切换

## 7. Monaco 格式化

- LSP 在线：`textDocument/formatting`
- Fallback：IPC `studio:format-document` → `formatDocument(source)`

## 8. 阶段路线图

| 阶段 | 覆盖 | 编辑 |
|------|------|------|
| **2a** | 模块树、FSF 表单 | FSF / decom / comment |
| **2b** | 声明 CRUD、VisualToolbar、关系图导航 | const/type/var + 进程字段 |
| **2c（当前）** | 进程/函数 CRUD、`InvariantPanel`、关系图 hover/边标签 | `patchProcess` IPC |
| **2d（当前）** | 双栏代码联动、breadcrumb、诊断跳转 | `revealSpan` + 高亮装饰 |

## 9. UX 打磨（Phase 2c/2d）

### 统一撤回栈

- Store：`stores/documentHistory.ts`，按 tab 维护 `undoStack` / `redoStack`
- Monaco 输入 debounce 300ms 合并快照；可视化 patch 立即 `pushSnapshot`
- Undo/Redo 经 `EditorWorkspace.applyContent` 写回并 `pushStackElement` 重置 Monaco 内部栈

### 剪贴板与小地图

- Monaco 焦点时不拦截 Ctrl+C/V/X/A；非 Monaco 使用 `editor.action.clipboard*` action
- 小地图：`showRegionSectionHeaders: false`、`renderCharacters: false`

### 滚动条

- `main.css` 全局 `--scrollbar-*` 变量与 `.studio-scroll` 圆角细滚动条
- Monaco `.scrollbar .slider` 与 Studio 主题一致

### 代码联动

- `VisualEditor` breadcrumb（模块 › 进程/函数）
- 树/图/声明/不变式/诊断点击 → `@reveal-span` → `MonacoEditor.revealSpan`（行高亮 2s）
- `ParseErrorBanner` 列出前 8 条诊断并可跳转

### VisualModel 扩展

| 字段 | 用途 |
|------|------|
| `diagnostics[]` | 解析/语义诊断，含 `span` |
| `modules[].invariants[]` | 不变式文本与 `span` |
| `modules[].processes[].span` | 进程块定位 |
| `modules[].functions[]` | `name` + `text` + `span`（树显示 `fn.name`） |

### 进程/函数 patch

- `@agile-sofl/editor-api`：`processPatch.ts`（`addProcess` / `removeProcess` / `addFunction` / …）
- IPC：`studio:patch-process`；工具栏「添加进程」「添加函数」

## 10. 布局与 i18n（Round 2）

### 工具栏（Phase 2，已由 Phase 3 调整）

- **主工具栏**（`EditorToolbar`）：仅 `双栏 | 代码 | 可视化`
- **可视化工具栏**（`VisualToolbar`）：左侧 `树形 | 关系图`；关系图模式下缩放数字 +「适应窗口」；搜索框；刷新/应用/CRUD

### 可视化面板分栏

- 内层 `ResizableSplit`：左侧导航（树或关系图）| 右侧详情，可拖拽调整宽度
- `editorUi.visualNavRatio`：树形默认约 22%，关系图默认 **50%**（`localStorage` 持久化）
- 关系图/树组件不再使用固定 `w-56`

### 代码 ↔ 可视化同步

- `useVisualModel`：`lastRebuiltContent` 避免重复 parse；可视化 patch 后不再用 `skipNextParse` 吞掉代码编辑
- `rebuildNow` / 手动刷新：`resetVisualChannel` 清空增量状态
- `parseFailed` 从 `true→false` 时自动重建
- 详情子组件 `:key` 含 `modelGen`，避免修复代码后表单草稿残留

### 工作区与 Monaco 中文

- 切换 Studio 语言 **不 reload**，tab 与未保存内容保留；`sessionStorage` 快照作崩溃恢复
- Monaco 右键中文：`monaco-editor-nls-adapter` + `optimizeDeps.exclude: ['monaco-editor']`（dev 须走 NLS 插件而非预构建包）

## 11. Phase 3 — 容错解析、图视口与交互

### 容错可视化

- IPC `studio:build-visual-model` 使用 `buildVisualModelTolerant`（`parse()` 默认 tolerant），不再经 `checkIncremental` 的 strict 路径
- `parseFailed`：仅 `ast == null`；`hasDiagnostics`：存在 error 诊断
- 有部分 AST 时仍构建 `moduleGraph` / `modules` DTO；`ParseErrorBanner` 截断长 `Expecting…` 消息，可展开详情
- 写操作（patch/CRUD）在 `hasDiagnostics` 时禁用；树/图导航与只读浏览不受影响

### 关系图视口

- `useGraphViewport`：默认 `cursor: grab` 拖拽平移；滚轮垂直平移；Ctrl+滚轮以指针为中心缩放
- 切换至关系图或数据变更时 `fitToView()`；`editorUi.graphZoomPercent`（25–200%）与工具栏数字输入双向同步
- `ModuleGraphView`：`overflow: hidden`，SVG `<g transform>` 包裹节点；节点卡片含类型副标题（SYSTEM/子模块/进程/函数）
- `GraphToolPalette`：选择 / 平移 / 适应窗口（`editorUi.graphTool` 持久化）

### 交互（Phase 3）

- `VisualContextMenu`：树与图右键统一动作（定位代码、添加/删除进程与函数等）
- `ModuleTree`：进程拖拽仅调整列表顺序（`localStorage`，不写回源码）；双击等同选中并定位
- `VisualIssuesPanel`：按行列出 error 诊断并跳转
- 全局 `Ctrl+C/V/X`：在 `.visual-panel` / `.studio-text-selectable` 内有选区时放行原生剪贴板
- 滚动条 `--scrollbar-size: 6px`；Vite `sourcemapIgnoreList` 忽略 `monaco-editor` 路径

### 测试

- `packages/editor-api/tests/visualParse.test.ts` — tolerant fixture 仍有 modules
- `packages/studio/tests/truncateDiagnostic.test.ts`、`editCommands.test.ts`

## 12. LSP 与高亮

- LSP spawn 策略链：系统 Node → `ELECTRON_RUN_AS_NODE` → `utilityProcess`
- 关闭时先 `stopLanguageServer()` 再销毁窗口，避免 `Object has been destroyed`
- TextMate scope 经 `highlight-scope-map.json` 映射为 Monaco theme token
- 小地图：`renderCharacters: false`、`showRegionSectionHeaders: false`
