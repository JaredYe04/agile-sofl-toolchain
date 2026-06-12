import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import {
  agileSoflDarkFieldTheme,
  agileSoflDarkTheme,
  agileSoflLightFieldTheme,
  agileSoflLightTheme,
  semanticTokenRulesForTheme
} from './themes'

function withSemanticRules(
  theme: typeof agileSoflLightTheme,
  isDark: boolean
): typeof agileSoflLightTheme {
  return {
    ...theme,
    rules: [...theme.rules, ...semanticTokenRulesForTheme(isDark)]
  }
}

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

  monaco.editor.defineTheme('agile-sofl-light', withSemanticRules(agileSoflLightTheme, false))
  monaco.editor.defineTheme('agile-sofl-dark', withSemanticRules(agileSoflDarkTheme, true))
  monaco.editor.defineTheme('agile-sofl-light-field', withSemanticRules(agileSoflLightFieldTheme, false))
  monaco.editor.defineTheme('agile-sofl-dark-field', withSemanticRules(agileSoflDarkFieldTheme, true))

  monaco.languages.register({ id: 'agile-sofl', extensions: ['.asfl'], aliases: ['Agile-SOFL', 'ASFL'] })
}

export function applyMonacoTheme(themeName: 'agile-sofl-light' | 'agile-sofl-dark'): void {
  monaco.editor.setTheme(themeName)
}

export { monaco }
