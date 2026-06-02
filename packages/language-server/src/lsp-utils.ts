/**
 * LSP ↔ parser diagnostic/span utilities.
 */

import type { Diagnostic as AsflDiagnostic } from '@agile-sofl/parser'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import {
  Diagnostic,
  DiagnosticSeverity,
  Range,
  Position
} from 'vscode-languageserver/node.js'
import type { Span } from '@agile-sofl/parser'

function columnToUtf16(document: TextDocument, line: number, column: number): number {
  if (column <= 0) return 0
  const lines = document.getText().split(/\r\n|\r|\n/)
  const lineText = lines[line] ?? ''
  return Math.min(column, lineText.length)
}

export function spanToRange(span: Span, document: TextDocument): Range {
  if (!Number.isFinite(span.line) || span.line < 1) {
    return Range.create(Position.create(0, 0), Position.create(0, 1))
  }
  const startLine = Math.max(0, span.line - 1)
  const endLine = Math.max(0, span.line - 1)
  const startChar = columnToUtf16(document, startLine, span.column - 1)
  const endChar = columnToUtf16(document, endLine, span.column)
  return Range.create(
    Position.create(startLine, startChar),
    Position.create(endLine, Math.max(startChar + 1, endChar))
  )
}

export function diagnosticToLsp(d: AsflDiagnostic, document: TextDocument): Diagnostic {
  return Diagnostic.create(
    spanToRange(d.span, document),
    d.message,
    severityToLsp(d),
    d.code,
    'agile-sofl'
  )
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
