import type { HybridSpecGenerator } from './types.js'
import { ruleBasedHybridGenerator, RULE_BASED_GENERATOR_ID } from './ruleBased.js'
import { createLlmHybridGenerator, LLM_GENERATOR_ID } from './llm.js'
import type { LlmCompleteFn } from './types.js'

const generators = new Map<string, HybridSpecGenerator>()
generators.set(RULE_BASED_GENERATOR_ID, ruleBasedHybridGenerator)

export function registerHybridGenerator(generator: HybridSpecGenerator): void {
  generators.set(generator.id, generator)
}

export function getHybridGenerator(id: string): HybridSpecGenerator | undefined {
  return generators.get(id)
}

export function listHybridGenerators(): HybridSpecGenerator[] {
  return [...generators.values()]
}

export function registerLlmHybridGenerator(complete: LlmCompleteFn): HybridSpecGenerator {
  const gen = createLlmHybridGenerator(complete)
  registerHybridGenerator(gen)
  return gen
}

export { RULE_BASED_GENERATOR_ID, LLM_GENERATOR_ID, ruleBasedHybridGenerator, createLlmHybridGenerator }
export * from './types.js'
export {
  defaultHybridGenerateParams,
  normalizeGenerateParams,
  stagesToScope,
  formatGenerationPromptExtras,
  buildHybridAgentBootstrap,
  generationAgentPermissions
} from './params.js'
export { informalToHybridIR, hybridIRToAspec, irToGenerationResult, filterHybridIR } from './ir.js'
export { normalizeHybridIR } from './validate.js'
