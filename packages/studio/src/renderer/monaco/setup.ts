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
  monaco.languages.register({ id: 'agile-aspec', extensions: ['.aspec'], aliases: ['Agile-ASPEC', 'Informal Spec'] })
  monaco.languages.setMonarchTokensProvider('agile-aspec', {
    tokenizer: {
      root: [
        [/^[\s-]*[\w]+:/, 'keyword'],
        [/#.+$/, 'comment'],
        [/\|.*/, 'string'],
        [/.*/, 'source']
      ]
    }
  })
  monaco.languages.registerCompletionItemProvider('agile-aspec', {
    triggerCharacters: [' ', ':', '\n'],
    provideCompletionItems: () => ({
      suggestions: [
        'aspecVersion', 'meta', 'system', 'modules', 'bookAlign',
        'id', 'title', 'hybridTarget', 'name', 'purpose', 'scope',
        'description', 'processes', 'functions', 'types', 'variables',
        'invariants', 'scenarios', 'condition', 'outcome', 'decomposition',
        'refinementHints', 'bottomLevel', 'expectedFsfLevel', 'signature',
        'inputs', 'outputs', 'typeHint', 'bodyHint', 'preconditions', 'postconditions'
      ].map((label) => ({
        label,
        kind: monaco.languages.CompletionItemKind.Property,
        insertText: `${label}: `
      }))
    })
  })
}

export function applyMonacoTheme(themeName: 'agile-sofl-light' | 'agile-sofl-dark'): void {
  monaco.editor.setTheme(themeName)
}

export { monaco }
