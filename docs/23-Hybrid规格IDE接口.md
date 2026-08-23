# 23 — Hybrid 规格 IDE 接口

Hybrid 列继续以 `.asfl` 为单一事实来源。VisualEditor 表单是精细编辑，不是唯一入口。

## 方向

用户用自然语言描述过程/场景 → 建议 `process` + FSF 骨架 → 经 `editor-api` `patchProcess` 写回。解析失败时切到代码 Tab。

## 扩展点

`packages/studio/src/renderer/specAssist/types.ts`：

```ts
export interface HybridAssistantProvider {
  id: string
  labelKey: string
  suggest: (input: {
    source: string
    moduleName: string | null
    selection?: string
  }) => HybridSuggestion[] | Promise<HybridSuggestion[]>
}
```

- `registerHybridAssistantProvider`
- 内置 `studio.hybrid.heuristic`：从选区短语生成 ident + process stub
- `studio.hybrid.ai`：空实现
- UI：「过程骨架」按钮 → 短句 → `process Name (x: nat) ok: nat` + 简单 FSF

## 左列模块树菜单

`packages/studio/src/renderer/workspaceTree/`：

- Context：`blank` | `project` | `systemModule` | `module`
- `registerWorkspaceTreeMenuProvider` / `buildWorkspaceTreeMenu`
- 删除项目：仅移出 SQLite 索引，不删磁盘
- 删除/重命名模块：`patchModule`
