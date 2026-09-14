import type { InformalSpecification } from '../informal/model.js'
import type { AspecDiagnostic } from '../model.js'

export type TraceRelation = 'refines' | 'implements' | 'uses' | 'derives-from' | 'constrains'

/** @deprecated Prefer HybridGenerateParams.stages. Still used by batch filter. */
export type GenerationScope = 'hybrid' | 'module' | 'process' | 'scenario'

export type GenerationRuntime = 'batch' | 'agent'

export type HybridGenerateStages = {
  hybridSpec: boolean
  modules: boolean
  processes: boolean
  scenarios: boolean
  typesVars?: boolean
  invariants?: boolean
  gui?: boolean
}

export type DetailLevel = 0 | 1 | 2 | 3 | 4

export type ExistingStrategy = 'ask' | 'merge' | 'rebuild'

export type ModuleSplitStrategy = 'ask' | 'single-system' | 'cluster-by-function'

export interface HybridGenerateParams {
  stages: HybridGenerateStages
  detailLevel: DetailLevel
  strategy: ExistingStrategy
  inferUnstatedDesign: boolean
  moduleSplit: ModuleSplitStrategy
  locale?: 'zh-CN' | 'en'
}

export interface HybridGenerateRequest {
  input: InformalSpecification
  params: HybridGenerateParams
  context: GenerationContext
}

export type AgentSpecPermissions = {
  informal: { read: boolean; write: boolean }
  hybrid: { read: boolean; write: boolean }
}

export interface HybridAgentBootstrap {
  skillId: 'hybrid-generation'
  title: string
  initialUserMessage: string
  promptExtras: string
  permissions: AgentSpecPermissions
}

export type HybridGenerateOutcome =
  | { kind: 'document'; result: HybridGenerationResult }
  | { kind: 'agent-session'; bootstrap: HybridAgentBootstrap }

export type FormalizationStatus = 'semi-formal' | 'formal' | 'mixed'

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

export interface HybridScenarioIR {
  id?: string
  name?: string
  guard: string
  definingCondition: string
  exceptional?: boolean
}

export interface HybridProcessIR {
  id?: string
  name: string
  informalId?: string
  description?: string
  inputs: Array<{ name: string; typeHint: string }>
  outputs: Array<{ name: string; typeHint: string }>
  ext?: Array<{ access: 'rd' | 'wr'; name: string; typeHint?: string }>
  pre?: string
  post?: string
  preconditions: string[]
  postconditions: string[]
  scenarios?: HybridScenarioIR[]
  children?: string[]
  formalizationStatus?: FormalizationStatus
}

export interface HybridTypeIR {
  id?: string
  name: string
  informalId?: string
  fields: Array<{ name: string; typeHint: string; description?: string }>
}

export interface HybridInvariantIR {
  id?: string
  name: string
  informalId?: string
  description: string
}

export interface SemanticModuleIR {
  id?: string
  name: string
  types: HybridTypeIR[]
  variables: Array<{ name: string; typeHint: string; informalId?: string }>
  processes: HybridProcessIR[]
  invariants: HybridInvariantIR[]
}

export interface HybridSpecificationIR {
  moduleName: string
  modules?: SemanticModuleIR[]
  types: HybridTypeIR[]
  variables: Array<{ name: string; typeHint: string; informalId?: string }>
  processes: HybridProcessIR[]
  invariants: HybridInvariantIR[]
}

export interface HybridChangeItem {
  id: string
  kind: 'module' | 'type' | 'variable' | 'process' | 'invariant' | 'scenario'
  name: string
  summary: string
  selected?: boolean
}

export interface GenerationContext {
  projectName?: string
  existingAsfl?: string
  locale?: 'zh-CN' | 'en'
  /** @deprecated Prefer params.stages */
  scope?: GenerationScope
  moduleName?: string
  processName?: string
  selectedNodeIds?: string[]
  params?: HybridGenerateParams
  extra?: Record<string, unknown>
}

export interface HybridGenerationResult {
  specification: HybridSpecificationIR
  asflText: string
  traceLinks: SpecTraceLink[]
  warnings: GenerationWarning[]
  diagnostics?: AspecDiagnostic[]
  changes?: HybridChangeItem[]
}

export interface HybridSpecGenerator {
  id: string
  name: string
  runtime?: GenerationRuntime
  generate(
    input: InformalSpecification,
    context: GenerationContext
  ): Promise<HybridGenerationResult>
  agentBootstrap?(request: HybridGenerateRequest): HybridAgentBootstrap
}

export type LlmCompleteFn = (request: {
  system: string
  user: string
  json?: boolean
}) => Promise<string>
