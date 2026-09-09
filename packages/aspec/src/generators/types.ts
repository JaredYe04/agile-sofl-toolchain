import type { InformalSpecification } from '../informal/model.js'
import type { AspecDiagnostic } from '../model.js'

export type TraceRelation = 'refines' | 'implements' | 'uses' | 'derives-from' | 'constrains'

export interface SpecTraceLink {
  id: string
  sourceId: string
  targetId: string
  relation: TraceRelation
  confidence?: number
}

export interface GenerationWarning {
  code: string
  message: string
  nodeId?: string
}

export interface HybridProcessIR {
  name: string
  informalId?: string
  description?: string
  inputs: Array<{ name: string; typeHint: string }>
  outputs: Array<{ name: string; typeHint: string }>
  preconditions: string[]
  postconditions: string[]
  children?: string[]
}

export interface HybridTypeIR {
  name: string
  informalId?: string
  fields: Array<{ name: string; typeHint: string; description?: string }>
}

export interface HybridInvariantIR {
  name: string
  informalId?: string
  description: string
}

export interface HybridSpecificationIR {
  moduleName: string
  types: HybridTypeIR[]
  variables: Array<{ name: string; typeHint: string; informalId?: string }>
  processes: HybridProcessIR[]
  invariants: HybridInvariantIR[]
}

export interface GenerationContext {
  projectName?: string
  existingAsfl?: string
  locale?: 'zh-CN' | 'en'
  extra?: Record<string, unknown>
}

export interface HybridGenerationResult {
  specification: HybridSpecificationIR
  asflText: string
  traceLinks: SpecTraceLink[]
  warnings: GenerationWarning[]
  diagnostics?: AspecDiagnostic[]
}

export interface HybridSpecGenerator {
  id: string
  name: string
  generate(
    input: InformalSpecification,
    context: GenerationContext
  ): Promise<HybridGenerationResult>
}

export type LlmCompleteFn = (request: {
  system: string
  user: string
  json?: boolean
}) => Promise<string>
