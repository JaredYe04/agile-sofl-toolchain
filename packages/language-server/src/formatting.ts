/**
 * Document formatting via parser pretty-printer.
 */

import { format } from '@agile-sofl/parser'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { TextEdit } from 'vscode-languageserver/node.js'
import { Range } from 'vscode-languageserver/node.js'

export function formatDocument(document: TextDocument): TextEdit[] {
  const source = document.getText()
  const { source: formatted, diagnostics } = format(source)
  if (diagnostics.some((d) => d.severity === 'error')) {
    return []
  }
  if (formatted === source) {
    return []
  }
  const fullRange = Range.create(
    { line: 0, character: 0 },
    document.positionAt(source.length)
  )
  return [TextEdit.replace(fullRange, formatted)]
}
