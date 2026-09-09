import { specToTree, type InformalSpecification } from '../informal/model.js'
import type {
  GenerationContext,
  HybridSpecGenerator,
  HybridSpecificationIR,
  LlmCompleteFn
} from './types.js'
import { informalToHybridIR, irToGenerationResult } from './ir.js'

export const LLM_GENERATOR_ID = 'llm-baseline'

const SYSTEM_PROMPT = `You are an Agile-SOFL Hybrid Specification generator.
Convert an Informal Specification (Functions / Data Resources / Constraints) into a Hybrid Specification IR.
Return ONLY JSON matching this schema:
{
  "moduleName": "SYSTEM_Name",
  "types": [{"name": "TypeName", "informalId": "dr-...", "fields": [{"name": "field", "typeHint": "nat|real|bool|string|composed of ..."}]}],
  "variables": [{"name": "var_name", "typeHint": "TypeName", "informalId": "dr-..."}],
  "processes": [{
    "name": "ProcessName",
    "informalId": "fn-...",
    "description": "...",
    "inputs": [{"name": "x", "typeHint": "nat"}],
    "outputs": [{"name": "r", "typeHint": "nat"}],
    "preconditions": ["natural language or predicate"],
    "postconditions": ["natural language or predicate"],
    "children": ["ChildProcess"]
  }],
  "invariants": [{"name": "InvName", "informalId": "c-...", "description": "..."}]
}
Rules:
- Preserve informalIds from the input so traceability can be built.
- Process names must be Agile-SOFL identifiers (letter then letters/digits/underscore).
- Prefer nat/real/bool/string type hints.
- Do not invent a GUI.
- Input/Output/Result headings are not processes; fold them into signature or postconditions.
`

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced?.[1]) return fenced[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) return text.slice(start, end + 1)
  return text.trim()
}

export function createLlmHybridGenerator(complete: LlmCompleteFn): HybridSpecGenerator {
  return {
    id: LLM_GENERATOR_ID,
    name: 'LLM Hybrid Generator (ChatECNU baseline)',
    async generate(input: InformalSpecification, context: GenerationContext) {
      const fallback = informalToHybridIR(input)
      const user = JSON.stringify(
        {
          informal: specToTree(input),
          projectName: context.projectName,
          hint: 'Generate a Hybrid Specification IR for this informal spec.'
        },
        null,
        2
      )
      try {
        const raw = await complete({ system: SYSTEM_PROMPT, user, json: true })
        const parsed = JSON.parse(extractJson(raw)) as HybridSpecificationIR
        const ir: HybridSpecificationIR = {
          moduleName: parsed.moduleName || fallback.moduleName,
          types: Array.isArray(parsed.types) ? parsed.types : fallback.types,
          variables: Array.isArray(parsed.variables) ? parsed.variables : fallback.variables,
          processes: Array.isArray(parsed.processes) ? parsed.processes : fallback.processes,
          invariants: Array.isArray(parsed.invariants) ? parsed.invariants : fallback.invariants
        }
        return irToGenerationResult(input, ir)
      } catch {
        const result = irToGenerationResult(input, fallback)
        result.warnings.push({
          code: 'ASPEC_GEN_LLM_FALLBACK',
          message: 'LLM generation failed; used the rule-based Hybrid IR instead.'
        })
        return result
      }
    }
  }
}
