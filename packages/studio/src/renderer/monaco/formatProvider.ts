import type * as Monaco from 'monaco-editor'
import { monaco } from './setup'

let registered = false

export function registerAgileSoflFormatProvider(): void {
  if (registered) return
  registered = true

  monaco.languages.registerDocumentFormattingEditProvider('agile-sofl', {
    async provideDocumentFormattingEdits(model: Monaco.editor.ITextModel) {
      if (!window.studio?.formatDocument) return []
      const source = model.getValue()
      const formatted = await window.studio.formatDocument(source)
      if (!formatted || formatted === source) return []
      return [
        {
          range: model.getFullModelRange(),
          text: formatted
        }
      ]
    }
  })
}
