import { contextBridge, ipcRenderer } from 'electron'

export type FileOpenResult = {
  filePath: string
  content: string
  title: string
}

const studio = {
  // Window
  minimize: () => ipcRenderer.invoke('studio:window-minimize'),
  maximize: () => ipcRenderer.invoke('studio:window-maximize') as Promise<boolean>,
  close: () => ipcRenderer.invoke('studio:window-close'),
  isMaximized: () => ipcRenderer.invoke('studio:window-is-maximized') as Promise<boolean>,
  getPlatform: () => ipcRenderer.invoke('studio:app-get-platform') as Promise<string>,
  getLocale: () => ipcRenderer.invoke('studio:app-get-locale') as Promise<string>,
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

  // Files
  fileOpenDialog: () => ipcRenderer.invoke('studio:file-open-dialog') as Promise<FileOpenResult | null>,
  fileSaveDialog: (defaultName?: string) =>
    ipcRenderer.invoke('studio:file-save-dialog', defaultName) as Promise<string | null>,
  fileRead: (path: string) => ipcRenderer.invoke('studio:file-read', path) as Promise<FileOpenResult>,
  fileWrite: (path: string, content: string) =>
    ipcRenderer.invoke('studio:file-write', path, content) as Promise<{ filePath: string; title: string }>,
  showMessageBox: (options: Electron.MessageBoxOptions) =>
    ipcRenderer.invoke('studio:show-message-box', options) as Promise<Electron.MessageBoxReturnValue>,

  // LSP
  lspSend: (jsonBody: string) => ipcRenderer.send('studio:lsp-send', jsonBody),
  lspOnMessage: (cb: (message: string) => void) => {
    const handler = (_: unknown, message: string) => cb(message)
    ipcRenderer.on('studio:lsp-message', handler)
    return () => ipcRenderer.removeListener('studio:lsp-message', handler)
  },
  lspOnStatusChanged: (cb: (status: { running: boolean }) => void) => {
    const handler = (_: unknown, status: { running: boolean }) => cb(status)
    ipcRenderer.on('studio:lsp-status-changed', handler)
    return () => ipcRenderer.removeListener('studio:lsp-status-changed', handler)
  },
  getLspStatus: () =>
    ipcRenderer.invoke('studio:lsp-status') as Promise<{ running: boolean; message: string }>
}

contextBridge.exposeInMainWorld('studio', studio)

export type StudioApi = typeof studio
