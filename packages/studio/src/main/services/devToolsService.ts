import { app, type BrowserWindow } from 'electron'

function toggleDevTools(win: BrowserWindow): void {
  if (win.webContents.isDevToolsOpened()) {
    win.webContents.closeDevTools()
  } else {
    win.webContents.openDevTools({ mode: 'detach' })
  }
}

export function attachDevToolsShortcuts(win: BrowserWindow): void {
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return

    const isF12 = input.key === 'F12'
    const isCtrlShiftI =
      (input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i'

    if (isF12 || isCtrlShiftI) {
      event.preventDefault()
      toggleDevTools(win)
    }
  })
}

export function attachRendererDiagnostics(win: BrowserWindow): void {
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[studio:renderer] did-fail-load', { errorCode, errorDescription, validatedURL })
  })

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[studio:renderer] render-process-gone', details)
  })

  if (app.isPackaged) return

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const tag = level === 3 ? 'error' : level === 2 ? 'warn' : 'log'
    console[tag === 'log' ? 'log' : tag](`[studio:renderer:${tag}] ${message} (${sourceId}:${line})`)
  })
}

export function openDevTools(win: BrowserWindow | null): void {
  if (!win || win.isDestroyed()) return
  win.webContents.openDevTools({ mode: 'detach' })
}
