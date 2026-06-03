/**
 * Hover provider.
 */

import { parse, resolveScope } from '@agile-sofl/parser'
import { resolveReference, resolveDeclarationAtOffset } from '@agile-sofl/parser'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { Hover, Position } from 'vscode-languageserver/node.js'
import { spanToRange } from './position.js'

function formatSymbolSummary(kind: string, moduleName: string, name: string): string {
  return `**${kind}** \`${name}\` in module \`${moduleName}\``
}

export function getHover(document: TextDocument, position: Position): Hover | null {
  const source = document.getText()
  const offset = document.offsetAt(position)
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return null

  const scopeResult = resolveScope(ast)
  const target =
    resolveReference(ast, scopeResult, offset) ?? resolveDeclarationAtOffset(ast, scopeResult, offset)
  if (!target) return null

  const { symbol } = target
  const content = formatSymbolSummary(symbol.kind, symbol.moduleName, symbol.name)

  return {
    contents: { kind: 'markdown', value: content },
    range: spanToRange(document, target.span)
  }
}
