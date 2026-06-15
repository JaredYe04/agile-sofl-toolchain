import { contextBridge, ipcRenderer } from 'electron'

export type FileOpenResult = {
  filePath: string
  content: string
  title: string
}

const studio = {
  minimize: () => ipcRenderer.invoke('studio:window-minimize'),
  maximize: () => ipcRenderer.invoke('studio:window-maximize') as Promise<boolean>,
  close: () => ipcRenderer.invoke('studio:window-close'),
  isMaximized: () => ipcRenderer.invoke('studio:window-is-maximized') as Promise<boolean>,
  getPlatform: () => ipcRenderer.invoke('studio:app-get-platform') as Promise<string>,
  getLocale: () => ipcRenderer.invoke('studio:app-get-locale') as Promise<string>,
  openDevTools: () => ipcRenderer.invoke('studio:open-devtools') as Promise<void>,
  onMaximizedChanged: (cb: (maximized: boolean) => void) => {
    const handler = (_: unknown, maximized: boolean) => cb(maximized)
    ipcRenderer.on('studio:window-maximized-changed', handler)
    return () => ipcRenderer.removeListener('studio:window-maximized-changed', handler)
  },
  onRequestClose: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('studio:request-close', handler)
    return () => ipcRenderer.removeListener('studio:request-close', handler)
  },
  confirmClose: () => ipcRenderer.send('studio:confirm-close'),

  fileOpenDialog: (kind?: 'asfl' | 'aspec' | 'guispec' | 'any') =>
    ipcRenderer.invoke('studio:file-open-dialog', kind) as Promise<FileOpenResult | null>,
  fileSaveDialog: (defaultName?: string, kind?: 'asfl' | 'aspec' | 'guispec') =>
    ipcRenderer.invoke('studio:file-save-dialog', defaultName, kind) as Promise<string | null>,
  fileRead: (path: string) => ipcRenderer.invoke('studio:file-read', path) as Promise<FileOpenResult>,
  fileWrite: (path: string, content: string) =>
    ipcRenderer.invoke('studio:file-write', path, content) as Promise<{ filePath: string; title: string }>,
  lspSend: (jsonBody: string) => ipcRenderer.send('studio:lsp-send', jsonBody),
  lspOnMessage: (cb: (message: string) => void) => {
    const handler = (_: unknown, message: string) => cb(message)
    ipcRenderer.on('studio:lsp-message', handler)
    return () => ipcRenderer.removeListener('studio:lsp-message', handler)
  },
  lspOnStatusChanged: (cb: (status: { running: boolean; message?: string }) => void) => {
    const handler = (_: unknown, status: { running: boolean; message?: string }) => cb(status)
    ipcRenderer.on('studio:lsp-status-changed', handler)
    return () => ipcRenderer.removeListener('studio:lsp-status-changed', handler)
  },
  getLspStatus: () =>
    ipcRenderer.invoke('studio:lsp-status') as Promise<{ running: boolean; message: string }>,

  buildVisualModel: (source: string, channelId: string) =>
    ipcRenderer.invoke('studio:build-visual-model', source, channelId) as Promise<VisualModelPayload>,
  buildModuleGraphLayout: (
    graph: ModuleGraphPayload,
    options?: {
      searchQuery?: string
      tidy?: boolean
      orientation?: 'portrait' | 'landscape'
      moduleSizes?: Record<string, { width: number; height?: number }>
      processMeta?: Record<string, { isAlias?: boolean; aliasTarget?: string; hasExt?: boolean }>
    }
  ) => {
    const safeGraph = JSON.parse(JSON.stringify(graph)) as ModuleGraphPayload
    const safeOptions = options ? JSON.parse(JSON.stringify(options)) : undefined
    return ipcRenderer.invoke(
      'studio:build-module-graph-layout',
      safeGraph,
      safeOptions
    ) as Promise<ModuleGraphLayoutPayload>
  },
  resetVisualChannel: (channelId: string) =>
    ipcRenderer.invoke('studio:reset-visual-channel', channelId) as Promise<void>,
  patchDocument: (payload: PatchDocumentPayload) =>
    ipcRenderer.invoke('studio:patch-document', payload) as Promise<string>,
  formatDocument: (source: string) =>
    ipcRenderer.invoke('studio:format-document', source) as Promise<string>,
  patchDeclaration: (payload: PatchDeclarationPayload) =>
    ipcRenderer.invoke('studio:patch-declaration', payload) as Promise<string>,
  patchProcess: (payload: PatchProcessPayload) =>
    ipcRenderer.invoke('studio:patch-process', payload) as Promise<string>,
  patchFunction: (payload: PatchFunctionPayload) =>
    ipcRenderer.invoke('studio:patch-function', payload) as Promise<string>,
  patchInvariant: (payload: PatchInvariantPayload) =>
    ipcRenderer.invoke('studio:patch-invariant', payload) as Promise<string>,
  patchExt: (payload: PatchExtPayload) =>
    ipcRenderer.invoke('studio:patch-ext', payload) as Promise<string>,
  patchProcessSignature: (payload: PatchProcessSignaturePayload) =>
    ipcRenderer.invoke('studio:patch-process-signature', payload) as Promise<string>,
  patchFunctionSignature: (payload: PatchFunctionSignaturePayload) =>
    ipcRenderer.invoke('studio:patch-function-signature', payload) as Promise<string>,
  patchAlias: (payload: PatchAliasPayload) =>
    ipcRenderer.invoke('studio:patch-alias', payload) as Promise<string>,
  patchModule: (payload: PatchModulePayload) =>
    ipcRenderer.invoke('studio:patch-module', payload) as Promise<string>,
  patchProcessInit: (payload: PatchProcessInitPayload) =>
    ipcRenderer.invoke('studio:patch-process-init', payload) as Promise<string>,
  parsePredicateUi: (text: string) =>
    ipcRenderer.invoke('studio:parse-predicate-ui', text) as Promise<{
      ui: import('@agile-sofl/editor-api').PredicateUiNode | null
      error: string | null
    }>,
  uiToPredicateText: (node: import('@agile-sofl/editor-api').PredicateUiNode) =>
    ipcRenderer.invoke('studio:ui-to-predicate-text', node) as Promise<string>,
  validateSignature: (kind: 'process' | 'function', signature: string) =>
    ipcRenderer.invoke('studio:validate-signature', kind, signature) as Promise<
      { ok: true } | { ok: false; error: string }
    >,
  searchWorkspaceFiles: (rootDir: string, query?: string) =>
    ipcRenderer.invoke('studio:search-workspace-files', rootDir, query) as Promise<
      Array<{ path: string }>
    >,
  searchWorkspaceSymbols: (rootDir: string, query?: string) =>
    ipcRenderer.invoke('studio:search-workspace-symbols', rootDir, query) as Promise<
      Array<{
        uri: string
        name: string
        kind: string
        moduleName: string
        span: SerializableSpan
        containerName?: string
      }>
    >
  ,
  openProjectFolder: () => ipcRenderer.invoke('studio:open-project-folder') as Promise<string | null>,
  buildInformalModel: (source: string) =>
    ipcRenderer.invoke('studio:build-informal-model', source) as Promise<InformalModelPayload>,
  patchAspec: (payload: PatchAspecPayload) =>
    ipcRenderer.invoke('studio:patch-aspec', payload) as Promise<string>,
  refineAspec: (payload: RefineAspecPayload) =>
    ipcRenderer.invoke('studio:refine-aspec', payload) as Promise<RefineAspecResult>,
  buildCoverageReport: (payload: {
    aspecSource: string
    asflSource: string
    traceJson?: string
    guiSource?: string
  }) => ipcRenderer.invoke('studio:build-coverage-report', payload) as Promise<CoverageReportPayload>,
  patchInformal: (payload: { source: string; span: SerializableSpan; text: string }) =>
    ipcRenderer.invoke('studio:patch-informal', payload) as Promise<string>,
  buildHybridRegions: (source: string) =>
    ipcRenderer.invoke('studio:build-hybrid-regions', source) as Promise<HybridRegionPayload[]>,
  getInformalSpans: (source: string) =>
    ipcRenderer.invoke('studio:get-informal-spans', source) as Promise<InformalSpanPayload[]>,
  scanProject: (root: string) => ipcRenderer.invoke('studio:scan-project', root) as Promise<ProjectScanPayload>,
  writeTraceFile: (filePath: string, traceJson: string) =>
    ipcRenderer.invoke('studio:write-trace-file', filePath, traceJson) as Promise<boolean>,
  formatAspec: (source: string) => ipcRenderer.invoke('studio:format-aspec', source) as Promise<string>,
  buildGuiModel: (payload: { source: string; informalSource?: string }) =>
    ipcRenderer.invoke('studio:build-gui-model', payload) as Promise<GuiModelPayload>,
  patchGui: (payload: PatchGuiPayload & { source: string }) =>
    ipcRenderer.invoke('studio:patch-gui', payload) as Promise<string>,
  formatGui: (source: string) => ipcRenderer.invoke('studio:format-gui', source) as Promise<string>,
  resolveGuiForAspec: (payload: { aspecSource: string; externalGuiSource?: string }) =>
    ipcRenderer.invoke('studio:resolve-gui-for-aspec', payload) as Promise<GuiModelPayload>,
  patchAspecGui: (payload: { aspecSource: string; action: PatchGuiActionOnly }) =>
    ipcRenderer.invoke('studio:patch-aspec-gui', payload) as Promise<string>,
  findHybridSymbolSpan: (payload: { source: string; symbolName: string; kind?: 'process' | 'function' }) =>
    ipcRenderer.invoke('studio:find-hybrid-symbol-span', payload) as Promise<SerializableSpan | null>
}

export type SerializableSpan = {
  start: number
  end: number
  line: number
  column: number
}

export type DiagnosticSummary = {
  code: string
  message: string
  severity: string
  span: SerializableSpan
  source?: 'parse' | 'fsf' | 'lsp'
}

export type VisualDeclarationItem = {
  name: string
  text: string
  span: { start: number; end: number; line: number; column: number }
}

export type VisualFunctionItem = VisualDeclarationItem & {
  hasFsf?: boolean
  body?: string
  signature?: string
  params?: ParamGroupItem[]
  returnType?: string
  fsfFormal?: 'formal' | 'semi-formal' | null
}

export type VisualInvariantItem = {
  text: string
  span: SerializableSpan
}

export type ExtVarItem = {
  access: 'rd' | 'wr'
  name: string
  type?: string
}

export type ParamGroupItem = {
  names: string
  type: string
}

export type VisualModuleProcess = {
  name: string
  span?: SerializableSpan
  decom: string
  comment: string
  hasFsf: boolean
  isAlias?: boolean
  aliasTarget?: string
  isInit?: boolean
  signature?: string
  inputs?: ParamGroupItem[]
  outputs?: ParamGroupItem[]
  ext?: ExtVarItem[]
  fsfFormal?: 'formal' | 'semi-formal' | null
}

export type VisualModuleSummary = {
  name: string
  isSystem: boolean
  parentName?: string
  span: { start: number; end: number; line: number; column: number }
  constCount: number
  typeCount: number
  varCount: number
  invCount: number
  invariants: VisualInvariantItem[]
  processes: VisualModuleProcess[]
  functions: VisualFunctionItem[]
  consts: VisualDeclarationItem[]
  types: VisualDeclarationItem[]
  vars: VisualDeclarationItem[]
}

export type ModuleGraphLayoutPayload = {
  compounds: Array<{
    moduleId: string
    name: string
    moduleRole?: string
    depth?: number
    x: number
    y: number
    width: number
    height: number
    sections: Array<{
      key: string
      titleKey: string
      rows: Array<{
        nodeId: string
        kind: string
        label: string
        moduleName: string
        processName?: string
        functionName?: string
        hidden?: boolean
      }>
      y: number
      height: number
    }>
    rowByNodeId: Record<string, { x: number; y: number; w: number; h: number }>
  }>
  edges: Array<{
    from: string
    to: string
    kind: string
    x1: number
    y1: number
    x2: number
    y2: number
  }>
  bbox: { minX: number; minY: number; maxX: number; maxY: number }
}

export type ModuleGraphPayload = {
  nodes: Array<{ id: string; kind: string; name: string; parentId?: string; moduleRole?: string }>
  edges: Array<{ from: string; to: string; kind: string }>
}

export type VisualModelPayload = {
  parseFailed: boolean
  hasDiagnostics: boolean
  documentModel: unknown
  diagnostics: DiagnosticSummary[]
  moduleGraph: unknown
  fsfModels: unknown[]
  modules: VisualModuleSummary[]
}

export type PatchProcessPayload = {
  source: string
  moduleName: string
  kind: 'process' | 'function'
  action: 'add' | 'remove' | 'rename'
  name: string
  newName?: string
  template?: string
}

export type PatchDeclarationPayload = {
  source: string
  moduleName: string
  kind: 'const' | 'type' | 'var'
  action: 'patch' | 'add' | 'remove'
  name?: string
  text?: string
}

export type PatchDocumentPayload = {
  source: string
  kind: 'fsf' | 'comment' | 'decom'
  processName: string
  scenarios?: Array<{ id: string; test: string; def: string; span: unknown }>
  others?: string
  text?: string
}

export type PatchInvariantPayload = {
  source: string
  span: SerializableSpan
  text: string
}

export type PatchFunctionPayload = {
  source: string
  moduleName: string
  name: string
  body?: string
  fsf?: {
    scenarios: Array<{ id: string; test: string; def: string; span: unknown }>
    others?: string
  }
}

export type PatchExtPayload = {
  source: string
  moduleName: string
  processName: string
  vars: ExtVarItem[]
}

export type PatchProcessSignaturePayload = {
  source: string
  moduleName: string
  processName: string
  signature: string
}

export type PatchFunctionSignaturePayload = {
  source: string
  moduleName: string
  functionName: string
  signature: string
}

export type PatchAliasPayload = {
  source: string
  moduleName: string
  processName: string
  aliasTarget: string
}

export type PatchModulePayload = {
  source: string
  action: 'add' | 'remove' | 'rename'
  moduleName: string
  newName?: string
  parentName?: string
  isSystem?: boolean
}

export type PatchProcessInitPayload = {
  source: string
  moduleName: string
  processName: string
  isInit: boolean
  fallbackName?: string
}

export type InformalDiagnostic = {
  code: string
  message: string
  severity: string
  path?: string
  line?: number
  column?: number
}

export type InformalScenarioPayload = {
  id: string
  condition: string
  outcome: string
}

export type InformalProcessPayload = {
  id: string
  name: string
  description?: string
  decomposition?: string
  notes?: string
  preconditions?: string
  postconditions?: string
  scenarios?: InformalScenarioPayload[]
  refinementHints?: { bottomLevel?: boolean; expectedFsfLevel?: 'semi-formal' | 'formal' }
  signature?: {
    inputs?: Array<{ name: string; typeHint?: string }>
    outputs?: Array<{ name: string; typeHint?: string }>
  }
}

export type InformalModulePayload = {
  id: string
  name: string
  description: string
  processes?: InformalProcessPayload[]
  functions?: Array<{ id: string; name: string; description?: string }>
  types?: Array<{ id: string; name: string; typeHint?: string }>
  variables?: Array<{ id: string; name: string; typeHint?: string }>
  invariants?: Array<{ id: string; textHint?: string; description?: string }>
}

export type BookAlignPayload = {
  functions?: Array<{ ref: string; description: string }>
  data?: Array<{ ref: string; description: string; usedBy?: string[] }>
  constraints?: Array<{ ref: string; description: string; refs?: string[] }>
}

export type InformalModelPayload = {
  meta: { id: string; title: string; hybridTarget?: string; guiTarget?: string }
  system: {
    name: string
    purpose: string
    scope?: string
    stakeholders?: string[]
    assumptions?: string
    glossary?: Array<{ term: string; definition: string }>
  }
  modules: InformalModulePayload[]
  bookAlign?: BookAlignPayload
  gui?: { appName: string; screenCount: number; flowCount: number; embedded: boolean; externalPath?: string }
  diagnostics: InformalDiagnostic[]
}

export type PatchAspecPayload = {
  source: string
  action:
    | 'patch-field'
    | 'patch-by-id'
    | 'add-process'
    | 'remove-process'
    | 'add-scenario'
    | 'remove-scenario'
    | 'add-module'
    | 'remove-module'
    | 'add-function'
    | 'remove-function'
    | 'add-type'
    | 'remove-type'
    | 'add-variable'
    | 'remove-variable'
    | 'add-invariant'
    | 'remove-invariant'
    | 'patch-book-align'
  path?: string
  idPath?: string
  value?: unknown
  moduleId?: string
  processId?: string
  scenarioId?: string
  functionId?: string
  typeId?: string
  variableId?: string
  invariantId?: string
  process?: InformalProcessPayload
  scenario?: InformalScenarioPayload
  module?: InformalModulePayload
  function?: { id: string; name: string; description?: string; bodyHint?: string }
  type?: { id: string; name: string; typeHint?: string; description?: string }
  variable?: { id: string; name: string; typeHint?: string; description?: string }
  invariant?: { id: string; textHint?: string; description?: string }
  bookAlign?: BookAlignPayload
}

export type RefineAspecPayload = {
  source: string
  aspecUri?: string
  asflUri?: string
  existingAsfl?: string
  skeletonOnly?: boolean
  mergePlans?: Array<{ aspecId: string; processName: string; strategy: string }>
}

export type RefineAspecResult = {
  asflText: string
  traceability: { traceVersion: string; links: Array<{ aspecId: string; kind: string; status: string }> }
  warnings: InformalDiagnostic[]
  checkOk: boolean
  checkDiagnostics?: InformalDiagnostic[]
}

export type CoverageReportPayload = {
  total: number
  covered: number
  partial: number
  missing: number
  stale: number
  percent: number
  items: Array<{ aspecId: string; kind: string; name: string; status: string; detail?: string }>
}

export type HybridRegionPayload = {
  type: 'fsf' | 'informal' | 'comment' | 'decom'
  span: SerializableSpan
}

export type InformalSpanPayload = {
  processName: string
  field: 'comment' | 'decom' | 'fsf'
  text: string
  span: SerializableSpan
}

export type ProjectScanPayload = {
  root: string
  aspecFiles: string[]
  asflFiles: string[]
  guispecFiles: string[]
  pairs: Array<{ aspecPath: string; asflPath?: string; guispecPath?: string; tracePath?: string }>
}

export type GuiWidgetKind =
  | 'label'
  | 'text-input'
  | 'button'
  | 'checkbox'
  | 'select'
  | 'list'
  | 'table'
  | 'section'
  | 'navigation'

export type GuiWidget = {
  id: string
  kind: GuiWidgetKind
  label?: string
  description?: string
  action?: string
  binds?: { param?: string; variable?: string; display?: string }
  options?: string[]
}

export type GuiScreenDto = {
  id: string
  name: string
  title?: string
  description?: string
  triggersProcess?: string
  widgets?: GuiWidget[]
  widgetCount: number
}

export type GuiModelPayload = {
  meta: { id: string; title: string; informalTarget?: string }
  app: { name: string; description?: string }
  screens: GuiScreenDto[]
  flows: Array<{ from: string; to: string; on?: string; label?: string }>
  diagnostics: InformalDiagnostic[]
  sourceKind: 'guispec' | 'aspec-embedded'
}

export type PatchGuiActionOnly =
  | { action: 'patch-by-id'; idPath: string; value: unknown }
  | { action: 'add-screen'; screen: { id: string; name: string; title?: string; widgets?: GuiWidget[] } }
  | { action: 'remove-screen'; screenId: string }
  | { action: 'add-widget'; screenId: string; widget: GuiWidget }
  | { action: 'remove-widget'; widgetId: string }
  | { action: 'add-flow'; flow: { from: string; to: string; on?: string } }
  | { action: 'remove-flow'; from: string; to: string }
  | { action: 'patch-app'; field: string; value: unknown }

export type PatchGuiPayload = PatchGuiActionOnly

export type InformalProcessOption = { id: string; name: string; moduleId: string }

contextBridge.exposeInMainWorld('studio', studio)

export type StudioApi = typeof studio
