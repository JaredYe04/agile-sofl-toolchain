export type AtomicityStatus = 'atomic' | 'ready' | 'open'

export type DataItemKind = 'given' | 'retrieve' | 'obligation'

export type RefinementStepKind =
  | 'FormalizePredicate'
  | 'DecomposeProcess'
  | 'BalanceFlows'
  | 'DefineType'
  | 'BindConstraint'
  | 'DeclareAtomic'
  | 'Extend'
  | 'IntroduceRetrieve'
  | 'DischargeDataObligation'
  | 'SetCdfd'
  | 'ClassifyGrain'
  | 'ResolveVariation'

export type EffectPattern = 'insert' | 'update' | 'remove' | 'query' | 'batch' | 'mixed' | 'opaque'

export type GrainClass = 'operation' | 'abstract' | 'unclassified'

export interface GrainVariationView {
  id: string
  text: string
  source: 'author-text' | 'effect' | 'step'
  disposition: 'unresolved' | 'scenario' | 'child' | 'waived'
  childName?: string
}

export interface InformalAtomRef {
  key: string
  moduleName: string
  processName: string
  clause: 'pre' | 'post' | 'fsf'
  text: string
}

export interface RefinementProcessRow {
  moduleName: string
  processName: string
  hasDecom: boolean
  decomTarget?: string
  informalAtomCount: number
  typesDefined: boolean
  scenarioCoverageComplete: boolean
  onCdfd: boolean
  isStub: boolean
  structurallyAtomic: boolean
  informalAtoms: InformalAtomRef[]
  declaredAtomic: boolean
  status: AtomicityStatus
  effectPattern: EffectPattern
  grainClass: GrainClass
  nameEffectMismatch: boolean
  variations: GrainVariationView[]
  grainClosed: boolean
  operationallyAtomic: boolean
}

export interface RefinementModuleRow {
  name: string
  isSystem: boolean
  parentName?: string
  isEmpty: boolean
}

export interface ProcessAmbiguityBreakdown {
  informalAtomCount: number
  incompleteScenarioCount: number
  openConditionCount: number
  unbalancedBoundaryCount: number
  undeclaredAtomicCount: number
  emptyModuleCount: number
  stubProcessCount: number
}

export interface DataRefinementItemView {
  kind: DataItemKind
  typeName: string
  retrieveFunction?: string
  message: string
  discharged: boolean
  target: string
}

export interface RefinementLogEntry {
  id: string
  at: string
  kind: RefinementStepKind
  target: string
  processAmbiguityBefore: number
  processAmbiguityAfter: number
  dataAmbiguityBefore: number
  dataAmbiguityAfter: number
  note?: string
}

export interface RefinementStateDto {
  processAmbiguity: number
  dataAmbiguity: number
  grainAmbiguity: number
  informalAtoms: InformalAtomRef[]
  unloggedFormalizations: number
  unloggedGrainClosures: number
  diagnostics: Array<{ code: string; message: string; severity: string }>
  processes: RefinementProcessRow[]
  modules: RefinementModuleRow[]
  breakdown: ProcessAmbiguityBreakdown
  dataItems: DataRefinementItemView[]
  log: RefinementLogEntry[]
}

export function emptyRefinementState(): RefinementStateDto {
  return {
    processAmbiguity: 0,
    dataAmbiguity: 0,
    grainAmbiguity: 0,
    informalAtoms: [],
    unloggedFormalizations: 0,
    unloggedGrainClosures: 0,
    diagnostics: [],
    processes: [],
    modules: [],
    breakdown: {
      informalAtomCount: 0,
      incompleteScenarioCount: 0,
      openConditionCount: 0,
      unbalancedBoundaryCount: 0,
      undeclaredAtomicCount: 0,
      emptyModuleCount: 0,
      stubProcessCount: 0
    },
    dataItems: [],
    log: []
  }
}
