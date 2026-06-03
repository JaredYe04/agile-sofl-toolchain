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
import { diagnosticsForDocument } from './diagnosticCache.js'
import { formatDocument } from './formatting.js'
import { collectDocumentSymbols } from './symbols.js'
import { getDefinition } from './definition.js'
import { getHover } from './hover.js'
import { getCompletions } from './completion.js'
import { buildSemanticTokens, SEMANTIC_TOKEN_MODIFIERS, SEMANTIC_TOKEN_TYPES } from './semanticTokens.js'
import { collectFoldingRanges } from './folding.js'
import { collectWorkspaceSymbols } from './workspaceSymbols.js'
import { syncDocument, removeDocument } from './projectIndex.js'

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
    documentSymbolProvider: true,
    definitionProvider: true,
    hoverProvider: true,
    completionProvider: {
      triggerCharacters: [':', '.', '/', '[', '|']
    },
    foldingRangeProvider: true,
    workspaceSymbolProvider: true,
    semanticTokensProvider: {
      legend: {
        tokenTypes: [...SEMANTIC_TOKEN_TYPES],
        tokenModifiers: [...SEMANTIC_TOKEN_MODIFIERS]
      },
      full: true
    }
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
      connection.sendDiagnostics({ uri, diagnostics: diagnosticsForDocument(doc) })
    }, debounceMs)
  )
}

documents.onDidChangeContent((change) => {
  syncDocument(change.document)
  scheduleDiagnostics(change.document)
})

documents.onDidOpen((event) => {
  syncDocument(event.document)
  connection.sendDiagnostics({
    uri: event.document.uri,
    diagnostics: diagnosticsForDocument(event.document)
  })
})

documents.onDidClose((event) => {
  removeDocument(event.document.uri)
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

connection.languages.semanticTokens.on((params) => {
  const doc = documents.get(params.textDocument.uri)
  if (!doc) return { data: [] }
  return buildSemanticTokens(doc)
})

connection.onDefinition((params) => {
  const doc = documents.get(params.textDocument.uri)
  if (!doc) return null
  return getDefinition(doc, params.position)
})

connection.onHover((params) => {
  const doc = documents.get(params.textDocument.uri)
  if (!doc) return null
  return getHover(doc, params.position)
})

connection.onCompletion((params) => {
  const doc = documents.get(params.textDocument.uri)
  if (!doc) return []
  return getCompletions(doc, params.position)
})

connection.onFoldingRanges((params) => {
  const doc = documents.get(params.textDocument.uri)
  if (!doc) return []
  return collectFoldingRanges(doc)
})

connection.onWorkspaceSymbol((params) => {
  const results = []
  for (const doc of documents.all()) {
    results.push(...collectWorkspaceSymbols(doc, params.query))
  }
  return results
})

documents.listen(connection)
connection.listen()
