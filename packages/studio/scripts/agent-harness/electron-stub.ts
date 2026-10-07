/** Minimal `electron` stand-in for headless runs of main-process services (no UI, no IPC). */
import { join, resolve } from 'node:path'

const studioDir = resolve(process.env.AGILE_SOFL_STUDIO_DIR || process.cwd())
const userData = process.env.AGILE_SOFL_HARNESS_USERDATA || join(studioDir, '.harness-userdata')

export const app = {
  getPath: (_name: string) => userData,
  getAppPath: () => studioDir,
  isPackaged: false,
  getVersion: () => '0.0.0-harness'
}
const noop = () => undefined
export const ipcMain = { handle: noop, on: noop, removeHandler: noop }
export const dialog = {}
export const shell = {}
export const BrowserWindow = class {}
export const utilityProcess = {}
export default { app, ipcMain, dialog, shell, BrowserWindow, utilityProcess }
