import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('studio', {
  getLspStatus: () => ipcRenderer.invoke('studio:lsp-status') as Promise<{ running: boolean; message: string }>,
  buildDocumentModel: (source: string) =>
    ipcRenderer.invoke('studio:build-document-model', source) as Promise<{
      modules: string[]
      errorCount: number
    }>
})
