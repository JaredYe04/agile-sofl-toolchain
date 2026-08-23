# 21 — Informal Spec IDE 接口与 handoff

Phase 1 的 Informal 列提供项目级 `.aspec` 纯文本（Monaco）加窄工具槽。`.aspec` 文本仍是单一事实来源。结构化卡片编辑器（`InformalVisualEditor`）保留在代码库中，但不进入四栏工作区。

## 产品方向

用户用自然语言起草；IDE 把内容约束到 Informal 约定（`system` / `modules` / `F_n` `D_n` `C_n`、场景条），经 **用户确认的补丁** 写回 YAML（现有 `patchAspec`）。不要再堆一套表单树。

## 扩展点（已落地 TypeScript）

路径：`packages/studio/src/renderer/specAssist/`

```ts
export interface InformalAssistantProvider {
  id: string
  labelKey: string
  suggest: (input: { source: string; selection?: string }) => InformalSuggestion[] | Promise<InformalSuggestion[]>
}

export type InformalSuggestion = {
  id: string
  title: string
  kind: 'insert' | 'patch-aspec'
  insertText?: string
  patch?: Omit<PatchAspecPayload, 'source'>
}
```

注册：`registerInformalAssistantProvider`。内置：

- `studio.informal.heuristic`：从「功能：/数据：/约束：」或 `F_n` 行提取条目
- `studio.informal.ai`：空实现，预留给模型调用（输入全文+选区，输出建议补丁）

工具槽模板：系统目的、模块、功能+场景、数据、约束。执行后走 `patchAspec`。

## 非目标（本阶段）

- 在 Informal 列恢复模块级卡片树
- 把 Informal 绑到单个 Hybrid 模块
- 接入真实 LLM
