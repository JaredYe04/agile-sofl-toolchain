export type {
  GuiDocument,
  GuiDocumentModel,
  GuiScreen,
  GuiScreenDto,
  GuiWidget,
  GuiWidgetKind,
  GuiFlow,
  GuiSection,
  GuiApp,
  GuiMeta,
  GuiBinds,
  GuiDiagnostic,
  InformalProcessRef,
  InformalVariableRef
} from './model.js'

export { parseGuiSpec, parseGuiFromAspecYaml } from './parse.js'
export type { ParseResult } from './parse.js'

export { validateGuiSpec } from './validate.js'
export { serializeGuiSpec, formatGuiSpec, guiSectionToYaml } from './serialize.js'

export {
  patchGui,
  patchFieldById,
  addGuiScreen,
  removeGuiScreen,
  addGuiWidget,
  removeGuiWidget,
  addGuiFlow,
  removeGuiFlow,
  extractGuiFromAspec,
  embedGuiInAspec,
  removeGuiFromAspec,
  mergeGuiSources,
  guispecFromGuiSection,
  formatGui
} from './patch.js'
export type { PatchGuiAction } from './patch.js'

export {
  buildGuiModel,
  buildGuiModelFromAspec,
  buildGuiModelTolerant,
  collectProcessRefs,
  collectVariableRefs
} from './buildGuiModel.js'

export { DiagnosticCodes, createDiagnostic } from './diagnostics/codes.js'

export { extendCoverageWithGui, buildGuiTraceLinks } from './trace/coverageGui.js'
