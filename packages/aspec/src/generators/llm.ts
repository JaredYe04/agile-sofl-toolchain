import { specToTree, type InformalSpecification } from '../informal/model.js'
import type {
  GenerationContext,
  HybridGenerateRequest,
  HybridSpecGenerator,
  LlmCompleteFn
} from './types.js'
import { informalToHybridIR, irToGenerationResult } from './ir.js'
import { normalizeHybridIR } from './validate.js'
import { buildHybridAgentBootstrap } from './params.js'

export const LLM_GENERATOR_ID = 'llm-baseline'

const SYSTEM_PROMPT = `You are an Agile-SOFL Hybrid Specification generator.
Convert Informal Specification (Functions / Data Resources / Constraints) into a Hybrid Specification IR.
Return ONLY JSON matching this schema:
{
  "moduleName": "SYSTEM_Name",
  "types": [{"name": "TypeName", "informalId": "dr-...", "fields": [{"name": "field", "typeHint": "nat|real|bool|string"}]}],
  "variables": [{"name": "var_name", "typeHint": "TypeName or set of TypeName", "informalId": "dr-..."}],
  "processes": [{
    "name": "ProcessName",
    "informalId": "fn-...",
    "description": "...",
    "inputs": [{"name": "x", "typeHint": "nat"}],
    "outputs": [{"name": "r", "typeHint": "nat"}],
    "ext": [{"access": "rd|wr", "name": "accounts"}],
    "pre": "structured natural language or formal predicate",
    "post": "if guard then defining else other defining",
    "scenarios": [{"name": "Success", "guard": "...", "definingCondition": "...", "exceptional": false}],
    "children": []
  }],
  "invariants": [{"name": "InvName", "informalId": "c-...", "description": "..."}]
}

Rules:
- The textual language is SOFL semi-formal notation: formally defined data, structured natural-language pre/post.
- Do NOT emit FSF source. FSF is derived later from pre/post (Spre ∧ Gi ∧ Di).
- Preserve informalIds from the input so traceability can be built.
- Process names must be Agile-SOFL identifiers (letter then letters/digits/underscore).
- Prefer nat/real/bool/string; composite data uses composed-of fields.
- Input/Output/Result headings are not processes; fold them into signature or pre/post.
- Do not invent a GUI.

ATM Withdraw few-shot (standard Agile-SOFL example):
Informal: Users withdraw amount from an account; data Account(account_id, password, balance); constraint balance >= 0.
IR process:
{
  "name": "Withdraw",
  "inputs": [{"name": "account_id", "typeHint": "nat"}, {"name": "amount", "typeHint": "real"}],
  "outputs": [{"name": "cash", "typeHint": "real"}, {"name": "error_message", "typeHint": "string"}],
  "ext": [{"access": "wr", "name": "accounts"}],
  "pre": "The specified account exists and the withdrawal amount is positive.",
  "post": "If the amount does not exceed the current balance then the corresponding amount is deducted from the account and the same amount is returned as cash else an appropriate error message is returned and the account remains unchanged.",
  "scenarios": [
    {"name": "SuccessfulWithdrawal", "guard": "amount does not exceed the current balance", "definingCondition": "cash = amount and balance is reduced"},
    {"name": "InsufficientBalance", "guard": "amount exceeds the current balance", "definingCondition": "error_message is returned and the account remains unchanged"}
  ]
}
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
    runtime: 'agent',
    agentBootstrap(request: HybridGenerateRequest) {
      return buildHybridAgentBootstrap(request)
    },
    async generate(input: InformalSpecification, context: GenerationContext) {
      const fallback = informalToHybridIR(input)
      const user = JSON.stringify(
        {
          informal: specToTree(input),
          projectName: context.projectName,
          existingHybrid: context.existingAsfl?.slice(0, 4000),
          scope: context.scope ?? 'hybrid',
          moduleName: context.moduleName,
          processName: context.processName,
          selectedNodeIds: context.selectedNodeIds,
          hint: 'Generate a Hybrid Specification IR. LLM returns JSON only; a serializer writes SOFL pre/post. Do not write FSF source.'
        },
        null,
        2
      )
      try {
        const raw = await complete({ system: SYSTEM_PROMPT, user, json: true })
        const parsed = JSON.parse(extractJson(raw)) as unknown
        const validated = normalizeHybridIR(parsed, fallback)
        const result = irToGenerationResult(input, validated.ir, context)
        for (const err of validated.errors) {
          result.warnings.push({ code: 'ASPEC_GEN_IR_INVALID', message: err })
        }
        return result
      } catch {
        const result = irToGenerationResult(input, fallback, context)
        result.warnings.push({
          code: 'ASPEC_GEN_LLM_FALLBACK',
          message: 'LLM generation failed; used the rule-based Hybrid IR instead.'
        })
        return result
      }
    }
  }
}
