/**
 * Go to definition provider.
 */

import { parse, resolveScope, resolveReference, resolveDeclarationAtOffset } from '@agile-sofl/parser'
import { TextDocument } from 'vscode-languageserver-textdocument'
import type { Location, Position } from 'vscode-languageserver/node.js'
import { spanToRange } from './position.js'
import { hasParseError } from './parseGuard.js'
import { getLspProjectIndex } from './projectIndex.js'

export function getDefinition(document: TextDocument, position: Position): Location | null {
  const source = document.getText()
  const offset = document.offsetAt(position)

  const indexed = getLspProjectIndex().findDefinition(document.uri, offset)
  if (indexed) {
    const targetDoc =
      indexed.uri === document.uri
        ? document
        : TextDocument.create(
            indexed.uri,
            'agile-sofl',
            1,
            getLspProjectIndex().get(indexed.uri)?.source ?? ''
          )
    return {
      uri: indexed.uri,
      range: spanToRange(targetDoc, indexed.target.span)
    }
  }

  if (hasParseError(source)) return null

  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return null

  const scopeResult = resolveScope(ast)
  const target =
    resolveReference(ast, scopeResult, offset) ?? resolveDeclarationAtOffset(ast, scopeResult, offset)
  if (!target || target.span.end <= target.span.start) return null

  return {
    uri: document.uri,
    range: spanToRange(document, target.span)
  }
}
