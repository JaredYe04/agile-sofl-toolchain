# 16 — Studio 可视化编辑器迭代记录

本文记录各阶段能力完成情况。与 [15-Studio可视化编辑器.md](./15-Studio可视化编辑器.md)、[packages/studio/DESIGN.md](../packages/studio/DESIGN.md) 互补。

## 已完成（Phase 4–5）

- 混合设计策略、`CodeField`、Visual UI 组件库、统一 debounce、FSF 校验
- ext 块、签名编辑、equal 别名、模块 CRUD、形式/半形式徽章
- `Modal.vue`、关系图导出 token 对齐、内联重命名

## 已完成（Phase 6）

| 项 | 实现 |
|----|------|
| 结构化签名编辑 | `ParamGroupEditor` + DTO `inputs`/`outputs`/`params`/`returnType`；`SignatureEditor` 可视化/代码双模式 |
| Init 进程 | `patchProcessInit` + `ProcessEditor` checkbox |
| SYSTEM 模块创建 | 新建模块 Modal 含「系统模块」checkbox |
| 模块 overview 内联重命名 | `ModuleOverview` header `InlineRename` |
| 诊断分级面板 | `VisualIssuesPanel` 支持 all/error/warning/info 过滤；`classifyFsf` 诊断合并入 visual model |
| `ExpressionField` 归档 | 已移除；predicate 统一使用 `CodeField` |
| Alt+letter 菜单 | `MenuBar` `accesskey` + 首字母下划线提示 |
| About 对话框 Modal 化 | Help 菜单 About/Docs 使用应用内 `Modal` |

## 已完成（Phase 7）

### 可视化同步修复（P0）

**根因**：`patchComment` / `patchDecom` 在字段已存在时，`textSpan` 仅覆盖值 token，但 `replacement` 含 `comment:` / `decom:` 前缀，`replaceSpan` 导致双重前缀（如 `comment: comment: test123`）。

**修复**：`patch.ts` 新增 `replaceFieldLine`（扩展到整行替换，保留缩进），与 `declarationPatch.replaceDeclLine` 同思路。

**回归测试**：

- `editor-api/tests/patchProcessFields.test.ts` — comment/decom 无双重前缀
- `editor-api/tests/visualPatchRoundtrip.test.ts` — 各字段 patch → parse → DTO roundtrip
- `contract.test.ts` — `not.toMatch(/comment:\s*comment:/)`

### 功能增强

| 项 | 实现 |
|----|------|
| 参数组 AST 校验 | `signatureValidation.ts` + `SignatureEditor` 内联错误并阻止非法 patch |
| Init 进程创建向导 | `onAddProcess` Modal（名称 + Init checkbox） |
| 诊断面板固定底栏 | `VisualIssuesPanel` 底部固定；`filterDiagnosticsBySelection` 按选中项过滤 |
| 关系图 ext/别名标注 | `decorateProcessLabel` + `processMeta`；chip 显示 `Dup =Sub.P`、`Worker [ext]` |
| Shell 清理 | 移除 preload 未使用的 `showMessageBox` |
| `extPatch` CRLF | Windows `\r\n` 下 ext 块替换不再吞掉 FSF 前行 |

## 已完成（Phase 8）

| 项 | 实现 |
|----|------|
| LSP + Visual 诊断合并 | `mergeDiagnostics` 合并 parse/fsf/LSP；Monaco markers → `lspDiagnostics` store；`EditorWorkspace` 统一 issues 底栏（code/visual/split 均可见） |
| 诊断来源标注 | Issues 面板显示 Parse / FSF / LSP 标签；状态栏显示 error/warning/info 分项计数 |
| Visual model 提升 | `useVisualModel` 提升至 `EditorWorkspace` + provide/inject；纯代码模式仍可重建 DTO 与诊断 |
| 选中项过滤共享 | `editorSelection` store；visual 模式按模块/进程/函数过滤，代码模式显示全文诊断 |
| File 对话框记忆目录 | `dialogState.ts` 持久化 `lastDir`；Open/Save 原生对话框 `defaultPath` 接续上次路径 |
| File Open 保留原生 | 需文件系统路径，继续使用 Electron `showOpenDialog` / `showSaveDialog`（非 Modal） |

### 架构说明

```mermaid
flowchart TB
  subgraph sources [诊断来源]
    Parse[parse + classifyFsf]
    LSP[Monaco LSP markers]
  end
  subgraph merge [合并层]
    MD[mergeDiagnostics]
    FD[filterDiagnosticsBySelection]
  end
  subgraph ui [UI]
    Panel[VisualIssuesPanel]
    Status[StatusBar counts]
  end
  Parse --> MD
  LSP --> MD
  MD --> FD
  FD --> Panel
  MD --> Status
```

**说明**：LSP 诊断依赖 Monaco 语言客户端；纯 visual 模式（Monaco 未挂载）时 issues 面板仅显示 parse/fsf 诊断。

## 测试与验收

- `editor-api/tests/mergeDiagnostics.test.ts` — LSP 去重、severity 排序、来源标注
- `editor-api/tests/filterDiagnostics.test.ts` — 按 selection 过滤
- `editor-api/tests/visualPatchRoundtrip.test.ts` — patch 同步协议矩阵
- 手测：scope 错误出现在 issues 底栏（LSP 标签）；代码/分屏/纯可视化模式底栏可见；Open 对话框记住上次目录
