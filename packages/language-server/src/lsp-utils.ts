/**
 * LSP ↔ parser diagnostic utilities.
 */

import type { Diagnostic as AsflDiagnostic } from '@agile-sofl/parser'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node.js'
import { spanToRange } from './position.js'

export { spanToRange } from './position.js'

export function diagnosticToLsp(d: AsflDiagnostic, document: TextDocument): Diagnostic {
  return Diagnostic.create(
    spanToRange(document, d.span),
    d.message,
    severityToLsp(d),
    d.code,
    'agile-sofl'
  )
}

export function parserDiagnosticsToLsp(
  diagnostics: AsflDiagnostic[],
  source: string,
  uri = 'file:///inline.asfl'
): Diagnostic[] {
  const document = { uri, getText: () => source } as TextDocument
  return diagnostics.map((d) => diagnosticToLsp(d, document))
}

function severityToLsp(d: AsflDiagnostic): DiagnosticSeverity {
  if (d.code === 'ASFL_FSF_001') return DiagnosticSeverity.Warning
  if (d.code === 'ASFL_FSF_002' || d.code === 'ASFL_FSF_003') return DiagnosticSeverity.Information
  switch (d.severity) {
    case 'warning':
      return DiagnosticSeverity.Warning
    case 'info':
      return DiagnosticSeverity.Information
    default:
      return DiagnosticSeverity.Error
  }
}
