import { dialog, ipcMain, type BrowserWindow } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { getLastDialogDir, rememberDialogPath } from './dialogState.js'

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
    const lastDir = await getLastDialogDir()
    const result = await dialog.showOpenDialog(win ?? undefined, {
      filters: [{ name: 'Agile-SOFL', extensions: ['asfl'] }],
      properties: ['openFile'],
      defaultPath: lastDir
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    await rememberDialogPath(filePath)
    const content = await readFile(filePath, 'utf-8')
    return { filePath, content, title: basename(filePath) }
  })

  ipcMain.handle('studio:file-save-dialog', async (_event, defaultName?: string) => {
    const win = getWindow()
    const lastDir = await getLastDialogDir()
    const result = await dialog.showSaveDialog(win ?? undefined, {
      filters: [{ name: 'Agile-SOFL', extensions: ['asfl'] }],
      defaultPath: lastDir ? joinLastDir(lastDir, defaultName ?? 'untitled.asfl') : (defaultName ?? 'untitled.asfl')
    })
    if (result.canceled || !result.filePath) return null
    await rememberDialogPath(result.filePath)
    return result.filePath
  })
}
