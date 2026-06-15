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

  ipcMain.handle('studio:file-open-dialog', async (_event, kind?: 'asfl' | 'aspec' | 'any') => {
    const win = getWindow()
    const lastDir = await getLastDialogDir()
    const filters =
      kind === 'aspec'
        ? [{ name: 'Informal Spec', extensions: ['aspec'] }]
        : kind === 'asfl'
          ? [{ name: 'Hybrid Spec', extensions: ['asfl'] }]
          : [
              { name: 'Agile-SOFL Specs', extensions: ['asfl', 'aspec'] },
              { name: 'Hybrid (.asfl)', extensions: ['asfl'] },
              { name: 'Informal (.aspec)', extensions: ['aspec'] }
            ]
    const result = await dialog.showOpenDialog(win ?? undefined, {
      filters,
      properties: ['openFile'],
      defaultPath: lastDir
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    await rememberDialogPath(filePath)
    const content = await readFile(filePath, 'utf-8')
    return { filePath, content, title: basename(filePath) }
  })

  ipcMain.handle(
    'studio:file-save-dialog',
    async (_event, defaultName?: string, kind: 'asfl' | 'aspec' = 'asfl') => {
      const win = getWindow()
      const lastDir = await getLastDialogDir()
      const ext = kind === 'aspec' ? 'aspec' : 'asfl'
      const defaultPath = defaultName ?? `untitled.${ext}`
      const result = await dialog.showSaveDialog(win ?? undefined, {
        filters: [{ name: kind === 'aspec' ? 'Informal Spec' : 'Hybrid Spec', extensions: [ext] }],
        defaultPath: lastDir ? joinLastDir(lastDir, defaultPath) : defaultPath
      })
      if (result.canceled || !result.filePath) return null
      await rememberDialogPath(result.filePath)
      return result.filePath
    }
  )

  ipcMain.handle('studio:open-project-folder', async () => {
    const win = getWindow()
    const lastDir = await getLastDialogDir()
    const result = await dialog.showOpenDialog(win ?? undefined, {
      properties: ['openDirectory'],
      defaultPath: lastDir
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const root = result.filePaths[0]
    await rememberDialogPath(root)
    return root
  })
}

function joinLastDir(dir: string, name: string): string {
  return join(dir, name)
}
