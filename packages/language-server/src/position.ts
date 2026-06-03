/**
 * UTF-16 accurate span → LSP range conversion.
 */

import type { TextDocument } from 'vscode-languageserver-textdocument'
import { Range } from 'vscode-languageserver/node.js'
import type { Span } from '@agile-sofl/parser'

export function spanToRange(document: TextDocument, span: Span): Range {
  if (span.end <= span.start) {
    return Range.create(document.positionAt(0), document.positionAt(1))
  }
  return Range.create(document.positionAt(span.start), document.positionAt(span.end))
}
