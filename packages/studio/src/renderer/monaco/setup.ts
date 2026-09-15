import * as monaco from 'monaco-editor'
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution.js'
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
        [/^---$/, 'delimiter.yaml', '@frontmatter'],
        [/^#{1,6}\s.*$/, 'keyword'],
        [/<!--.*?-->/, 'comment'],
        [/^[\s]*[-*]\s/, 'markup'],
        [/^aspecVersion:.+$/, 'keyword'],
        [/^[\s-]*[\w]+:/, 'keyword'],
        [/.*/, 'source']
      ],
      frontmatter: [
        [/^---$/, 'delimiter.yaml', '@pop'],
        [/[\w][-\w]*:/, 'keyword'],
        [/./, 'string']
      ]
    }
  })
  monaco.languages.registerCompletionItemProvider('agile-aspec', {
    triggerCharacters: ['#', ' ', '\n'],
    provideCompletionItems: (model, position) => {
      const line = model.getLineContent(position.lineNumber)
      const suggestions = [
        { label: '# Functions', insertText: '# Functions' },
        { label: '# Data Resources', insertText: '# Data Resources' },
        { label: '# Constraints', insertText: '# Constraints' },
        { label: '## Function', insertText: '## ${1:Function title}\n\n' },
        { label: '## Data resource', insertText: '## ${1:Data resource}\n\n' },
        { label: '## Constraint', insertText: '## ${1:Constraint}\n\n' }
      ].map((item) => ({
        label: item.label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: item.insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range: {
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: line.length + 1
        }
      }))
      return { suggestions }
    }
  })
}

export function applyMonacoTheme(themeName: 'agile-sofl-light' | 'agile-sofl-dark'): void {
  monaco.editor.setTheme(themeName)
}

export { monaco }
