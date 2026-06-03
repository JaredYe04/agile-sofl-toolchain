import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { agileSoflDarkTheme, agileSoflLightTheme } from './themes'

let initialized = false

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'editor') return new editorWorker()
    return new editorWorker()
  }
}

export function initMonacoBase(): void {
  if (initialized) return
  initialized = true

  monaco.editor.defineTheme('agile-sofl-light', agileSoflLightTheme)
  monaco.editor.defineTheme('agile-sofl-dark', agileSoflDarkTheme)

  monaco.languages.register({ id: 'agile-sofl', extensions: ['.asfl'], aliases: ['Agile-SOFL', 'ASFL'] })
}

export function applyMonacoTheme(themeName: 'agile-sofl-light' | 'agile-sofl-dark'): void {
  monaco.editor.setTheme(themeName)
}

export { monaco }
