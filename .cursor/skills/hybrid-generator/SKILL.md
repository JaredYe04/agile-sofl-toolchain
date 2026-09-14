---
name: hybrid-generator
description: Extend Informal → Hybrid generation via HybridSpecGenerator. Use when adding research generators, LLM baseline, trace links, or Generate Hybrid UI.
---

# Hybrid Generator

Do not implement `Markdown → LLM → SOFL text`.

`runtime: 'batch'` pipeline: Informal model → Hybrid IR → schema validation → SOFL `pre`/`post` serializer → `.asfl` + `traceLinks`. FSF is derived from pre/post. Enumerations print as `{<Tag>}`. Parser may accept bare `{Investor}` and `system` aliases; generators still write canonical `module` / `<Tag>` / `pre`/`post`.

`runtime: 'agent'` (`llm-baseline`): `agentBootstrap(request)` starts the existing Specification Agent with `hybrid-generation` skill and Hybrid write permission. Do not fork a second agent loop.

`HybridGenerateParams.stages` replaces deprecated `GenerationContext.scope`. `selectedNodeIds` still filters batch Apply Selected. LLM/agent should write via structured `propose_hybrid_changes` CRUD (`add`/`update`/`remove`/`replace-process-body`) after user Apply or auto-write. Prefer CRUD over dumping SOFL. If CRUD fails or the file is empty/out of sync, `read_hybrid_specification` with `view=source` then `propose_source_edit`. After each write, the agent reads the inventory (or source) and continues until the task is done, then summarizes.

```ts
import { registerHybridGenerator, irToGenerationResult } from '@agile-sofl/aspec'

registerHybridGenerator({
  id: 'my-research-gen',
  name: 'My generator',
  runtime: 'batch',
  async generate(input, context) {
    const ir = /* algorithm */
    return irToGenerationResult(input, ir, context)
  }
})
```

Built-ins: `rule-based` (batch), `llm-baseline` (agent, ChatECNU). Hybrid CRUD: `formatHybridInventory` / `applyHybridPatch` in `@agile-sofl/editor-api`.

See [docs/24-Informal-Markdown与Hybrid生成器.md](docs/24-Informal-Markdown与Hybrid生成器.md)
