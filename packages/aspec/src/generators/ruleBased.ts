import type { InformalSpecification } from '../informal/model.js'
import type { GenerationContext, HybridSpecGenerator } from './types.js'
import { informalToHybridIR, irToGenerationResult } from './ir.js'

export const RULE_BASED_GENERATOR_ID = 'rule-based'

export const ruleBasedHybridGenerator: HybridSpecGenerator = {
  id: RULE_BASED_GENERATOR_ID,
  name: 'Rule-based Hybrid Generator',
  async generate(input: InformalSpecification, _context: GenerationContext) {
    const ir = informalToHybridIR(input)
    return irToGenerationResult(input, ir)
  }
}
