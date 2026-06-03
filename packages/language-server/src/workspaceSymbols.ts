/**
 * Workspace symbol search across indexed documents.
 */

import { TextDocument } from 'vscode-languageserver-textdocument'
import { getLspProjectIndex } from './projectIndex.js'
import { SymbolInformation, SymbolKind } from 'vscode-languageserver/node.js'
import { spanToRange } from './position.js'

const KIND_MAP = {
  const: SymbolKind.Constant,
  type: SymbolKind.Class,
  var: SymbolKind.Variable,
  process: SymbolKind.Method,
  function: SymbolKind.Function,
  module: SymbolKind.Module
} as const

export function collectWorkspaceSymbols(document: TextDocument, query?: string): SymbolInformation[] {
  const index = getLspProjectIndex()
  index.upsert(document.uri, document.getText())

  return index.symbols(query).map((sym) => {
    const source =
      sym.uri === document.uri
        ? document.getText()
        : index.get(sym.uri)?.source ?? document.getText()
    const doc = TextDocument.create(sym.uri, 'agile-sofl', 1, source)
    return {
      name: sym.name,
      kind: KIND_MAP[sym.kind],
      location: { uri: sym.uri, range: spanToRange(doc, sym.span) },
      containerName: sym.containerName
    }
  })
}
