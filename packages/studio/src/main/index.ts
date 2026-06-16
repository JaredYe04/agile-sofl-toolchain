import { app, ipcMain, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registerFileHandlers } from './services/fileService'
import { registerWindowHandlers } from './services/windowService'
import { registerParseHandlers } from './services/parseService'
import { attachDevToolsShortcuts, attachRendererDiagnostics, openDevTools } from './services/devToolsService'
import {
  isLspRunning,
  getLspStatusMessage,
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

  attachDevToolsShortcuts(mainWindow)
  attachRendererDiagnostics(mainWindow)

  mainWindow.on('closed', () => {
    setLspWindow(null)
    mainWindow = null
  })

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

  mainWindow.webContents.once('did-finish-load', () => {
    startLanguageServer()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  if (!app.isPackaged) {
    mainWindow.webContents.once('did-finish-load', () => {
      openDevTools(mainWindow)
    })
  }
}

app.whenReady().then(() => {
  registerFileHandlers(getWindow)
  registerWindowHandlers(getWindow)

  try {
    registerParseHandlers()
  } catch (err) {
    console.error('[studio] Failed to register parse handlers:', err)
  }

  ipcMain.on('studio:lsp-send', (_event, jsonBody: string) => {
    sendToLanguageServer(jsonBody)
  })

  ipcMain.handle('studio:lsp-status', () => ({
    running: isLspRunning(),
    message: isLspRunning()
      ? getLspStatusMessage() || 'Language server connected'
      : getLspStatusMessage() ||
        'Language server not available — run npm run bundle --workspace @agile-sofl/language-server'
  }))

  ipcMain.handle('studio:open-devtools', () => {
    openDevTools(mainWindow)
  })

  ipcMain.on('studio:confirm-close', () => {
    allowClose = true
    stopLanguageServer()
    setLspWindow(null)
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
