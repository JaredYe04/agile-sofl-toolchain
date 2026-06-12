/**
 * Renderer-safe subset of @agile-sofl/editor-api (no @agile-sofl/parser dependency).
 * Vite aliases `@agile-sofl/editor-api` to this module in the renderer bundle.
 */
export { countBySeverity, mergeDiagnostics } from '../../../../editor-api/src/mergeDiagnostics.js'
export { filterDiagnosticsBySelection } from '../../../../editor-api/src/filterDiagnostics.js'
export { buildModuleGraphLayout, decorateProcessLabel } from '../../../../editor-api/src/moduleGraphLayout.js'
export type {
  MergedDiagnostic,
  DiagnosticSource
} from '../../../../editor-api/src/mergeDiagnostics.js'
export type {
  DiagnosticLike,
  SelectionFilterInput,
  ModuleSpanIndex
} from '../../../../editor-api/src/filterDiagnostics.js'
export type {
  ModuleGraph,
  ModuleGraphNode,
  ModuleGraphEdge,
  ModuleGraphNodeRole
} from '../../../../editor-api/src/moduleGraph.js'
export type {
  ModuleGraphLayoutOptions,
  ModuleGraphModuleSize,
  ProcessNodeMeta
} from '../../../../editor-api/src/moduleGraphLayout.js'
