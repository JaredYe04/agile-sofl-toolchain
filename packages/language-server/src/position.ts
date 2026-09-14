/**
 * UTF-16 accurate span → LSP range conversion.
 */

import type { TextDocument } from 'vscode-languageserver-textdocument'
import { Range } from 'vscode-languageserver/node.js'
import type { Span } from '@agile-sofl/parser'

export function spanToRange(document: TextDocument, span: Span): Range {
  const start = typeof span?.start === 'number' ? span.start : 0
  const end = typeof span?.end === 'number' ? span.end : start
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    const fallbackEnd = Math.min(1, document.getText().length)
    return Range.create(document.positionAt(0), document.positionAt(fallbackEnd || 0))
  }
  return Range.create(document.positionAt(start), document.positionAt(end))
}
