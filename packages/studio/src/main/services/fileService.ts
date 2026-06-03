import { dialog, ipcMain, type BrowserWindow } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'

export function registerFileHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('studio:file-read', async (_event, filePath: string) => {
    const content = await readFile(filePath, 'utf-8')
    return { filePath, content, title: basename(filePath) }
  })

  ipcMain.handle('studio:file-write', async (_event, filePath: string, content: string) => {
    await writeFile(filePath, content, 'utf-8')
    return { filePath, title: basename(filePath) }
  })

  ipcMain.handle('studio:file-open-dialog', async () => {
    const win = getWindow()
    const result = await dialog.showOpenDialog(win ?? undefined, {
      filters: [{ name: 'Agile-SOFL', extensions: ['asfl'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const content = await readFile(filePath, 'utf-8')
    return { filePath, content, title: basename(filePath) }
  })

  ipcMain.handle('studio:file-save-dialog', async (_event, defaultName?: string) => {
    const win = getWindow()
    const result = await dialog.showSaveDialog(win ?? undefined, {
      filters: [{ name: 'Agile-SOFL', extensions: ['asfl'] }],
      defaultPath: defaultName ?? 'untitled.asfl'
    })
    if (result.canceled || !result.filePath) return null
    return result.filePath
  })

  ipcMain.handle('studio:show-message-box', async (_event, options: Electron.MessageBoxOptions) => {
    const win = getWindow()
    return dialog.showMessageBox(win ?? undefined, options)
  })
}
