/**
 * Agile-SOFL Language Server (stdio).
 */

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  DidChangeConfigurationNotification
} from 'vscode-languageserver/node.js'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { collectDiagnostics } from './diagnostics.js'
import { formatDocument } from './formatting.js'
import { collectDocumentSymbols } from './symbols.js'

const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)

let debounceMs = 300
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

connection.onInitialize(() => ({
  capabilities: {
    textDocumentSync: {
      openClose: true,
      change: TextDocumentSyncKind.Incremental
    },
    documentFormattingProvider: true,
    documentSymbolProvider: true
  }
}))

connection.onInitialized(() => {
  connection.client.register(DidChangeConfigurationNotification.type, undefined)
})

connection.onDidChangeConfiguration((change) => {
  const settings = change.settings as { agileSofl?: { debounceMs?: number } } | undefined
  if (settings?.agileSofl?.debounceMs !== undefined) {
    debounceMs = settings.agileSofl.debounceMs
  }
})

function scheduleDiagnostics(document: TextDocument): void {
  const uri = document.uri
  const existing = pendingTimers.get(uri)
  if (existing) clearTimeout(existing)
  pendingTimers.set(
    uri,
    setTimeout(() => {
      pendingTimers.delete(uri)
      const doc = documents.get(uri)
      if (!doc) return
      connection.sendDiagnostics({ uri, diagnostics: collectDiagnostics(doc) })
    }, debounceMs)
  )
}

documents.onDidChangeContent((change) => {
  scheduleDiagnostics(change.document)
})

documents.onDidOpen((event) => {
  connection.sendDiagnostics({
    uri: event.document.uri,
    diagnostics: collectDiagnostics(event.document)
  })
})

connection.onDocumentFormatting((params) => {
  const doc = documents.get(params.textDocument.uri)
  if (!doc) return []
  return formatDocument(doc)
})

connection.onDocumentSymbol((params) => {
  const doc = documents.get(params.textDocument.uri)
  if (!doc) return []
  return collectDocumentSymbols(doc)
})

documents.listen(connection)
connection.listen()
