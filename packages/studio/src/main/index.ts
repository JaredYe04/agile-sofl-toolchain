import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { registerFileHandlers } from './services/fileService'
import { registerWindowHandlers } from './services/windowService'
import {
  isLspRunning,
  sendToLanguageServer,
  setLspWindow,
  startLanguageServer,
  stopLanguageServer
} from './lspBridge'

let mainWindow: BrowserWindow | null = null
let allowClose = false

function getWindow(): BrowserWindow | null {
  return mainWindow
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    frame: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Agile-SOFL Studio'
  })

  setLspWindow(mainWindow)
  startLanguageServer()

  mainWindow.on('close', (e) => {
    if (allowClose) return
    e.preventDefault()
    mainWindow?.webContents.send('studio:request-close')
  })

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('studio:window-maximized-changed', true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('studio:window-maximized-changed', false)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerFileHandlers(getWindow)
  registerWindowHandlers(getWindow)

  ipcMain.on('studio:lsp-send', (_event, jsonBody: string) => {
    sendToLanguageServer(jsonBody)
  })

  ipcMain.handle('studio:lsp-status', () => ({
    running: isLspRunning(),
    message: isLspRunning()
      ? 'Language server connected'
      : 'Language server not available — run npm run bundle --workspace @agile-sofl/language-server'
  }))

  ipcMain.on('studio:confirm-close', () => {
    allowClose = true
    mainWindow?.close()
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopLanguageServer()
  if (process.platform !== 'darwin') app.quit()
})
