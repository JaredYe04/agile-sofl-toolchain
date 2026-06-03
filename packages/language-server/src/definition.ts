/**
 * Go to definition provider.
 */

import { parse, resolveScope } from '@agile-sofl/parser'
import { resolveReference, resolveDeclarationAtOffset } from '@agile-sofl/parser'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { Location, Position } from 'vscode-languageserver/node.js'
import { spanToRange } from './position.js'

export function getDefinition(document: TextDocument, position: Position): Location | null {
  const source = document.getText()
  const offset = document.offsetAt(position)
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
