import type { InformalSpecification } from '../informal/model.js'
import type { GenerationContext, HybridSpecGenerator } from './types.js'
import { informalToHybridIR, irToGenerationResult } from './ir.js'

export const RULE_BASED_GENERATOR_ID = 'rule-based'

export const ruleBasedHybridGenerator: HybridSpecGenerator = {
  id: RULE_BASED_GENERATOR_ID,
  name: 'Rule-based Hybrid Generator',
  runtime: 'batch',
  async generate(input: InformalSpecification, context: GenerationContext) {
    const ir = informalToHybridIR(input)
    return irToGenerationResult(input, ir, context)
  }
}
