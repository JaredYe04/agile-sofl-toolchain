/**
 * Collect diagnostics from parser check pipeline.
 */

import { check } from '@agile-sofl/parser'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { Diagnostic } from 'vscode-languageserver/node.js'
import { diagnosticToLsp } from './lsp-utils.js'

export function collectDiagnostics(document: TextDocument): Diagnostic[] {
  const { diagnostics } = check(document.getText())
  return diagnostics.map((d) => diagnosticToLsp(d, document))
}
