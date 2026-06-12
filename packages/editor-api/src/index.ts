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

export { buildModuleGraph, drawableGraphEdges, resolveDecomTargetId } from './moduleGraph.js'
export type {
  ModuleGraph,
  ModuleGraphNode,
  ModuleGraphEdge,
  ModuleGraphNodeKind,
  ModuleGraphNodeRole
} from './moduleGraph.js'

export { buildModuleGraphLayout, decorateProcessLabel } from './moduleGraphLayout.js'
export type {
  CompoundModule,
  CompoundRow,
  CompoundSection,
  ModuleGraphLayout,
  ModuleGraphLayoutOptions,
  ModuleGraphLayoutOrientation,
  ModuleGraphModuleSize,
  ProcessNodeMeta,
  DrawableGraphEdge
} from './moduleGraphLayout.js'

export { filterDiagnosticsBySelection } from './filterDiagnostics.js'
export type {
  DiagnosticLike,
  SelectionFilterInput,
  ModuleSpanIndex
} from './filterDiagnostics.js'

export { mergeDiagnostics, countBySeverity } from './mergeDiagnostics.js'
export type { MergedDiagnostic, DiagnosticSource } from './mergeDiagnostics.js'

export {
  parsePredicateFragment,
  predicateToUi,
  printPredicateText,
  uiToPredicateText,
  parsePredicateUi,
  filterSymbolHints
} from './predicateModel.js'
export type { PredicateUiNode, ParsePredicateResult, SymbolHint } from './predicateModel.js'

export { buildVisualModelTolerant } from './visualParse.js'
export type { VisualModelResult, VisualParseDiagnostic, FsfFormalStatus } from './visualParse.js'

export {
  processSignatureText,
  functionSignatureText,
  paramGroupsFromNodes,
  buildProcessSignatureFromGroups,
  buildFunctionSignatureFromGroups
} from './signatureUtils.js'
export type { ParamGroupDto } from './signatureUtils.js'

export { patchExt } from './extPatch.js'
export type { ExtVarDto } from './extPatch.js'

export {
  patchProcessSignature,
  patchFunctionSignature,
  validateProcessSignature,
  validateFunctionSignature
} from './signaturePatch.js'
export type { SignatureValidationResult } from './signaturePatch.js'

export { addModule, removeModule, renameModule, patchModule } from './modulePatch.js'
export type { ModulePatchAction } from './modulePatch.js'

export {
  patchFsfSpec,
  patchComment,
  patchDecom,
  patchInformal,
  patchInvariant,
  formatDocument,
  getInformalSpans
} from './patch.js'

export {
  patchConst,
  addConst,
  removeConst,
  patchType,
  addType,
  removeType,
  patchVar,
  addVar,
  removeVar,
  patchDeclaration
} from './declarationPatch.js'
export type { DeclarationKind } from './declarationPatch.js'

export {
  addProcess,
  removeProcess,
  renameProcess,
  addFunction,
  removeFunction,
  renameFunction,
  patchAlias,
  patchProcessInit,
  patchProcess,
  patchFunction
} from './processPatch.js'
export type { ProcessPatchAction, FunctionPatchAction } from './processPatch.js'

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
