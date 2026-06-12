import { app } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

type DialogState = {
  lastDir?: string
}

let cached: DialogState = {}
let loaded = false

function statePath(): string {
  return join(app.getPath('userData'), 'dialog-state.json')
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return
  loaded = true
  try {
    const raw = await readFile(statePath(), 'utf8')
    cached = JSON.parse(raw) as DialogState
  } catch {
    cached = {}
  }
}

export async function getLastDialogDir(): Promise<string | undefined> {
  await ensureLoaded()
  return cached.lastDir
}

export async function rememberDialogPath(filePath: string): Promise<void> {
  await ensureLoaded()
  cached.lastDir = dirname(filePath)
  try {
    await writeFile(statePath(), JSON.stringify(cached), 'utf8')
  } catch {
    /* ignore persistence errors */
  }
}
