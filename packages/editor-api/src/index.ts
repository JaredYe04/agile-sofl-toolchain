export {
  buildDocumentModel,
  buildHybridRegions,
  collectHybridRegions,
  buildSymbolIndex,
  findProcess
} from './documentModel.js'
export type {
  DocumentModel,
  ModuleSummary,
  DiagnosticSummary,
  HybridRegion
} from './documentModel.js'

export {
  buildFsfModel,
  buildFsfModelFromSpec,
  buildAllFsfModels,
  buildFsfModelByName
} from './fsfModel.js'
export type { FsfScenarioDto, FsfModelDto } from './fsfModel.js'

export { buildModuleGraph } from './moduleGraph.js'
export type { ModuleGraph, ModuleGraphNode, ModuleGraphEdge, ModuleGraphNodeKind } from './moduleGraph.js'

export {
  patchFsfSpec,
  patchComment,
  patchDecom,
  patchInformal,
  formatDocument,
  getInformalSpans
} from './patch.js'

export { toSerializableSpan, sliceText } from './span.js'
export type { SerializableSpan } from './span.js'

export {
  ProjectIndex,
  createProjectIndex,
  checkIncremental,
  createIncrementalState,
  getChangedModules,
  check,
  parse,
  parseSpecification,
  formatDiagnostic
} from '@agile-sofl/parser'
export type {
  ProjectDocument,
  ProjectSymbol,
  DefinitionLocation,
  IncrementalCheckState,
  ProgramNode,
  ProcessNode,
  Diagnostic
} from '@agile-sofl/parser'
