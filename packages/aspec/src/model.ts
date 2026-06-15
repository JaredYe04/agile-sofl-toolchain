export type AspecSeverity = 'error' | 'warning' | 'info'

export interface AspecDiagnostic {
  code: string
  message: string
  severity: AspecSeverity
  path?: string
  line?: number
  column?: number
}

export interface AspecMeta {
  id: string
  title: string
  author?: string
  revision?: string
  hybridTarget?: string
}

export interface AspecGlossaryEntry {
  term: string
  definition: string
}

export interface AspecSystem {
  name: string
  purpose: string
  scope?: string
  stakeholders?: string[]
  assumptions?: string
  glossary?: AspecGlossaryEntry[]
}

export interface InformalParam {
  name: string
  typeHint?: string
  description?: string
}

export interface InformalSignature {
  inputs?: InformalParam[]
  outputs?: InformalParam[]
}

export interface InformalScenario {
  id: string
  condition: string
  outcome: string
}

export interface RefinementHints {
  expectedFsfLevel?: 'semi-formal' | 'formal'
  bottomLevel?: boolean
}

export interface InformalType {
  id: string
  name: string
  typeHint?: string
  description?: string
}

export interface InformalConst {
  id: string
  name: string
  valueHint?: string
  description?: string
}

export interface InformalVar {
  id: string
  name: string
  typeHint?: string
  description?: string
}

export interface InformalInv {
  id: string
  description?: string
  textHint?: string
}

export interface InformalProcess {
  id: string
  name: string
  description?: string
  signature?: InformalSignature
  scenarios?: InformalScenario[]
  preconditions?: string
  postconditions?: string
  decomposition?: string
  notes?: string
  refinementHints?: RefinementHints
}

export interface InformalFunction {
  id: string
  name: string
  description?: string
  signature?: InformalSignature
  bodyHint?: string
  refinementHints?: RefinementHints
}

export interface InformalModule {
  id: string
  name: string
  parent?: string
  parentModuleName?: string
  description: string
  types?: InformalType[]
  constants?: InformalConst[]
  variables?: InformalVar[]
  invariants?: InformalInv[]
  processes?: InformalProcess[]
  functions?: InformalFunction[]
}

export interface BookAlignFunction {
  ref: string
  description: string
}

export interface BookAlignDataItem {
  ref: string
  description: string
  usedBy?: string[]
}

export interface BookAlignConstraint {
  ref: string
  description: string
  refs?: string[]
}

export interface BookAlignSection {
  functions?: BookAlignFunction[]
  data?: BookAlignDataItem[]
  constraints?: BookAlignConstraint[]
}

export interface AspecDocument {
  aspecVersion: string
  meta: AspecMeta
  system: AspecSystem
  modules: InformalModule[]
  bookAlign?: BookAlignSection
}

export interface InformalModuleDto extends InformalModule {}

export interface InformalDocumentModel {
  meta: AspecMeta
  system: AspecSystem
  modules: InformalModuleDto[]
  bookAlign?: BookAlignSection
  diagnostics: AspecDiagnostic[]
  traceability?: TraceabilityGraph
}

export type TraceLinkStatus = 'covered' | 'partial' | 'missing' | 'stale'

export type TraceLinkKind =
  | 'module'
  | 'process'
  | 'function'
  | 'scenario'
  | 'type'
  | 'variable'
  | 'invariant'

export interface TraceLink {
  aspecId: string
  kind: TraceLinkKind
  asflSymbol?: string
  status: TraceLinkStatus
}

export interface TraceabilityGraph {
  traceVersion: string
  aspecUri?: string
  asflUri?: string
  contentHash?: string
  links: TraceLink[]
}

export interface CoverageItem {
  aspecId: string
  kind: TraceLinkKind
  name: string
  status: TraceLinkStatus
  detail?: string
}

export interface CoverageReport {
  total: number
  covered: number
  partial: number
  missing: number
  stale: number
  percent: number
  items: CoverageItem[]
}

export type MergeStrategy = 'use_generated' | 'keep_hybrid' | 'merge_fsf_only'

export interface ProcessMergePlan {
  aspecId: string
  processName: string
  strategy: MergeStrategy
}

export interface RefineOptions {
  skeletonOnly?: boolean
  preserveExisting?: boolean
  existingAsfl?: string
  mergePlans?: ProcessMergePlan[]
  emitTraceFile?: boolean
  aspecUri?: string
  asflUri?: string
  bookAlignStrict?: boolean
}

export interface RefineResult {
  asflText: string
  traceability: TraceabilityGraph
  warnings: AspecDiagnostic[]
  checkDiagnostics?: AspecDiagnostic[]
}

export interface ProjectPair {
  aspecPath: string
  asflPath?: string
  tracePath?: string
}

export interface ProjectScanResult {
  root: string
  aspecFiles: string[]
  asflFiles: string[]
  pairs: ProjectPair[]
}
