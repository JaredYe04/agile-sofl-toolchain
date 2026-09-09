# Informal Specification（Markdown）与 Hybrid Generator

本文说明 Studio 当前 Informal 规格的数据模型、Markdown 源格式、AI Agent 边界，以及 Informal → Hybrid 的可插拔生成器接口。给后续接入研究算法的同学使用。

## 1. 核心原则

1. Informal Specification 是**结构化的自然语言规格**，不是 YAML。
2. Markdown 只是用户可读的序列化；`InformalSpecification` 才是数据核心。
3. AI 只能产出 **Patch**，必须经过 Preview → 用户确认 → Apply。
4. Hybrid 的 Code View 与 Visual View 共同操作 Hybrid Model（`.asfl` + editor-api DTO）。
5. Informal → Hybrid 必须走 `HybridSpecGenerator`，并保留 Traceability。

## 2. 源文件

- 扩展名仍为 `.aspec`（项目配对逻辑不变）。
- **主格式**：Markdown-like，固定一级标题：

```markdown
# Functions
# Data Resources
# Constraints
```

- 节点 ID 由标题派生，**不**写进用户 Markdown。旧文件里的 `<!-- @id:... -->` 仍可解析，打开时会从编辑器中去掉。
- 规格元信息（`id` / `moduleId` / `title` / `hybridTarget` / `guiTarget`）放在项目内部文件 `.agile-sofl/informal-meta.json`，**不要**写进用户编辑的 `.aspec`。
- 旧 YAML `.aspec` 仍可解析（兼容）。旧 Markdown 若带 YAML frontmatter，打开时会迁到 sidecar 并从编辑器中去掉。
- Studio 新建项目默认写出无 frontmatter 的 Markdown。

示例：`packages/studio/public/templates/atm-informal.aspec`、`examples/atm-informal.aspec`。

## 3. Domain API（`@agile-sofl/aspec`）

```ts
import {
  parseInformalSpec,
  serializeInformalSpec,
  applyInformalPatch,
  patchInformalSource,
  detectAspecFormat,
  ruleBasedHybridGenerator,
  createLlmHybridGenerator,
  registerHybridGenerator
} from '@agile-sofl/aspec'
```

- `parse(serialize(model))` 保持 ID 与层级。
- 一级标题不在 schema 内会报 `ASPEC_MD_001`。
- YAML 文档仍走 `parseAspec` → 合成 `AspecDocument`，供旧 refine / coverage 使用。

## 4. HybridSpecGenerator 插件

```ts
interface HybridSpecGenerator {
  id: string
  name: string
  generate(
    input: InformalSpecification,
    context: GenerationContext
  ): Promise<HybridGenerationResult>
}
```

返回：

- `specification`: Hybrid IR（module / types / variables / processes / invariants）
- `asflText`: 由 IR 经现有 SOFL serializer（`refineToAsfl`）得到
- `traceLinks`: Informal 节点 ID → Hybrid 符号
- `warnings`

### 内置生成器

| id | 名称 | 说明 |
|----|------|------|
| `rule-based` | Rule-based Hybrid Generator | 确定性映射：Function→process，Data→type/var，Constraint→inv |
| `llm-baseline` | LLM Hybrid Generator | ChatECNU `ecnu-max`，输出 IR JSON，失败则回退 rule-based |

### 注册自定义生成器

在 Studio 主进程（或你的研究包）中：

```ts
import { registerHybridGenerator, irToGenerationResult, type HybridSpecGenerator } from '@agile-sofl/aspec'

export const myGenerator: HybridSpecGenerator = {
  id: 'research-pattern-v1',
  name: 'Pattern-based Generator',
  async generate(input, context) {
    const ir = /* 你的算法 */
    return irToGenerationResult(input, ir)
  }
}

registerHybridGenerator(myGenerator)
```

不要：`Markdown → LLM → 整份 SOFL 文本` 直接覆盖文件。
应：`Informal Model → IR → Hybrid Model → SOFL 文本`。

Studio UI：Informal 列 **Generate Hybrid** 会列出已注册生成器，生成后再写入 `hybrid.asfl`。

## 5. ChatECNU

- Base URL：`https://chat.ecnu.edu.cn/open/api/v1`
- 默认模型：`ecnu-max`
- Key：`packages/studio/.env` 的 `ECNU_API_KEY`（只在 Electron 主进程读取，不进渲染进程）
- 文档：[模型介绍](https://developer.ecnu.edu.cn/vitepress/llm/model.html)

## 6. Agent 工具

Agent 使用 function calling，而不是自由改文件：

- `ask_clarification`：选项 + 自定义输入卡片。已选答案再点其他选项时，询问是 fork 新对话还是覆盖原对话。
- 消息气泡可选中复制；底部提供「复制文字」「Fork 新对话」。
- `read_specification`：读取当前节点 id / 标题 / 正文。
- `propose_changes`：结构化 Patch（add / update / remove / move），基于当前 Informal 库存，可改可删已有条目。
- `review_specification`：完整性 / 精确性 / 一致性 / 可追踪性

会话持久化：`<project>/.agile-sofl/agent/sessions/*.json`

## 7. 目录

```
packages/aspec/src/informal/     Markdown model / parser / serializer / patch
packages/aspec/src/generators/   HybridSpecGenerator + IR + rule/LLM baseline
packages/studio/src/main/services/llm/  ChatECNU + agent loop
packages/studio/src/renderer/components/workspace/informal/
packages/studio/src/renderer/components/workspace/agent/
```
