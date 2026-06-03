import { app, ipcMain, type BrowserWindow } from 'electron'

export function registerWindowHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('studio:window-minimize', () => {
    getWindow()?.minimize()
  })

  ipcMain.handle('studio:window-maximize', () => {
    const win = getWindow()
    if (!win) return false
    if (win.isMaximized()) {
      win.unmaximize()
      return false
    }
    win.maximize()
    return true
  })

  ipcMain.handle('studio:window-close', () => {
    getWindow()?.close()
  })

  ipcMain.handle('studio:window-is-maximized', () => {
    return getWindow()?.isMaximized() ?? false
  })

  ipcMain.handle('studio:app-get-locale', () => {
    return app.getLocale()
  })

  ipcMain.handle('studio:app-get-platform', () => {
    return process.platform
  })
}
