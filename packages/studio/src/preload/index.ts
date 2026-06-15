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

  fileOpenDialog: () => ipcRenderer.invoke('studio:file-open-dialog') as Promise<FileOpenResult | null>,
  fileSaveDialog: (defaultName?: string) =>
    ipcRenderer.invoke('studio:file-save-dialog', defaultName) as Promise<string | null>,
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

contextBridge.exposeInMainWorld('studio', studio)

export type StudioApi = typeof studio
