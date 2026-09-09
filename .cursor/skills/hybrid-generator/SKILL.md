---
name: hybrid-generator
description: Extend Informal → Hybrid generation via HybridSpecGenerator. Use when adding research generators, LLM baseline, trace links, or Generate Hybrid UI.
---

# Hybrid Generator

Do not implement `Markdown → LLM → SOFL text`.

Pipeline: Informal model → Hybrid IR → `irToGenerationResult` → `.asfl` + `traceLinks`.

```ts
import { registerHybridGenerator, irToGenerationResult } from '@agile-sofl/aspec'

registerHybridGenerator({
  id: 'my-research-gen',
  name: 'My generator',
  async generate(input, context) {
    const ir = /* algorithm */
    return irToGenerationResult(input, ir)
  }
})
```

Built-ins: `rule-based`, `llm-baseline` (ChatECNU).

See [docs/24-Informal-Markdown与Hybrid生成器.md](docs/24-Informal-Markdown与Hybrid生成器.md)
