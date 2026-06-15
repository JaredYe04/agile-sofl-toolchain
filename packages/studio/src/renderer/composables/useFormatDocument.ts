import type * as Monaco from 'monaco-editor'
import type { TextEdit as LspTextEdit } from 'vscode-languageserver-types'
import { useDocumentStore } from '../stores/document'
import { useLspStore } from '../stores/lsp'
import { getLanguageClient } from '../monaco/languageClient'
import { monaco } from '../monaco/setup'

function lspRangeToMonaco(range: LspTextEdit['range']): Monaco.IRange {
  return new monaco.Range(
    range.start.line + 1,
    range.start.character + 1,
    range.end.line + 1,
    range.end.character + 1
  )
}

function applyLspEdits(model: Monaco.editor.ITextModel, edits: LspTextEdit[]): void {
  if (!edits.length) return
  const sorted = [...edits].sort((a, b) => {
    const offsetA = model.getOffsetAt({
      lineNumber: a.range.start.line + 1,
      column: a.range.start.character + 1
    })
    const offsetB = model.getOffsetAt({
      lineNumber: b.range.start.line + 1,
      column: b.range.start.character + 1
    })
    return offsetB - offsetA
  })
  const ops = sorted.map((edit) => ({
    range: lspRangeToMonaco(edit.range),
    text: edit.newText,
    forceMoveMarkers: true
  }))
  model.pushEditOperations([], ops, () => null)
}

async function formatViaIpc(source: string): Promise<string | null> {
  if (!window.studio?.formatDocument) return null
  const formatted = await window.studio.formatDocument(source)
  return formatted && formatted !== source ? formatted : null
}

async function formatViaAspec(source: string): Promise<string | null> {
  if (!window.studio?.formatAspec) return null
  const formatted = await window.studio.formatAspec(source)
  return formatted ?? null
}

async function formatViaGui(source: string): Promise<string | null> {
  if (!window.studio?.formatGui) return null
  return window.studio.formatGui(source)
}

export async function formatActiveDocument(
  editor: Monaco.editor.IStandaloneCodeEditor | null = null
): Promise<boolean> {
  const doc = useDocumentStore()
  const lsp = useLspStore()
  const tab = doc.activeTab
  if (!tab || tab.kind !== 'document') return false

  const model = editor?.getModel() ?? null
  const source = model?.getValue() ?? tab.content
  let formatted: string | null = null

  if (tab.documentKind === 'aspec') {
    formatted = await formatViaAspec(source)
    if (!formatted) return false
    doc.setContent(tab.id, formatted)
    if (model && model.getValue() !== formatted) {
      model.setValue(formatted)
      model.pushStackElement()
    }
    return true
  }

  if (tab.documentKind === 'guispec') {
    formatted = await formatViaGui(source)
    if (!formatted) return false
    doc.setContent(tab.id, formatted)
    if (model && model.getValue() !== formatted) {
      model.setValue(formatted)
      model.pushStackElement()
    }
    return true
  }

  if (lsp.running) {
    try {
      const client = getLanguageClient()
      if (client) {
        const edits = (await client.sendRequest('textDocument/formatting', {
          textDocument: { uri: tab.uri },
          options: { tabSize: 4, insertSpaces: true }
        })) as LspTextEdit[] | null

        if (edits?.length && model) {
          applyLspEdits(model, edits)
          formatted = model.getValue()
        }
      }
    } catch (err) {
      console.warn('[studio] LSP format failed, using fallback:', err)
    }
  }

  if (!formatted) {
    formatted = await formatViaIpc(source)
  }

  if (!formatted) return false

  doc.setContent(tab.id, formatted)
  if (model && model.getValue() !== formatted) {
    model.setValue(formatted)
    model.pushStackElement()
  }
  return true
}

export function formatEditorInstance(
  editor: Monaco.editor.IStandaloneCodeEditor | null
): Promise<boolean> {
  if (!editor) return formatActiveDocument(null)
  const action = editor.getAction('editor.action.formatDocument')
  if (action?.isSupported?.() !== false) {
    return action
      .run()
      .then(() => true)
      .catch(() => formatActiveDocument(editor))
  }
  return formatActiveDocument(editor)
}
