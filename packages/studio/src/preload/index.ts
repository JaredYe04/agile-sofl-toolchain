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
  showMessageBox: (options: Electron.MessageBoxOptions) =>
    ipcRenderer.invoke('studio:show-message-box', options) as Promise<Electron.MessageBoxReturnValue>,

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
  resetVisualChannel: (channelId: string) =>
    ipcRenderer.invoke('studio:reset-visual-channel', channelId) as Promise<void>,
  patchDocument: (payload: PatchDocumentPayload) =>
    ipcRenderer.invoke('studio:patch-document', payload) as Promise<string>,
  formatDocument: (source: string) =>
    ipcRenderer.invoke('studio:format-document', source) as Promise<string>,
  patchDeclaration: (payload: PatchDeclarationPayload) =>
    ipcRenderer.invoke('studio:patch-declaration', payload) as Promise<string>,
  patchProcess: (payload: PatchProcessPayload) =>
    ipcRenderer.invoke('studio:patch-process', payload) as Promise<string>
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
}

export type VisualDeclarationItem = {
  name: string
  text: string
  span: { start: number; end: number; line: number; column: number }
}

export type VisualFunctionItem = VisualDeclarationItem

export type VisualInvariantItem = {
  text: string
  span: SerializableSpan
}

export type VisualModuleProcess = {
  name: string
  span?: SerializableSpan
  decom: string
  comment: string
  hasFsf: boolean
}

export type VisualModuleSummary = {
  name: string
  isSystem: boolean
  parentName?: string
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

contextBridge.exposeInMainWorld('studio', studio)

export type StudioApi = typeof studio
