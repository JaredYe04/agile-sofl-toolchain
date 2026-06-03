import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { buildDocumentModel } from '@agile-sofl/editor-api'
import { startLanguageServer, stopLanguageServer } from './lsp'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Agile-SOFL Studio'
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  startLanguageServer()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopLanguageServer()
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('studio:lsp-status', () => ({
  running: true,
  message: 'Language server spawned from main process (stdio reference)'
}))

ipcMain.handle('studio:build-document-model', (_event, source: string) => {
  const model = buildDocumentModel(source)
  return {
    modules: model.modules.map((m) => m.name),
    errorCount: model.errorCount
  }
})
