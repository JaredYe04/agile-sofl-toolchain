/**
 * Diagnostic codes and types for Agile-SOFL parser/checker.
 */

import type { Span } from '../ast/span.js'

export type DiagnosticSeverity = 'error' | 'warning' | 'info'

export interface Diagnostic {
  code: string
  message: string
  severity: DiagnosticSeverity
  span: Span
}

export const DiagnosticCodes = {
  PARSE_ERROR: 'ASFL_PARSE_001',
  LEX_ERROR: 'ASFL_LEX_001',
  UNDEFINED_SYMBOL: 'ASFL_SCOPE_001',
  DUPLICATE_SYMBOL: 'ASFL_SCOPE_002',
  PARENT_VAR_WRITE: 'ASFL_SCOPE_003',
  TYPE_MISMATCH: 'ASFL_TYPE_001',
  UNKNOWN_TYPE: 'ASFL_TYPE_002',
  INVALID_BUILTIN: 'ASFL_TYPE_003',
  FSF_INFORMAL_BOTTOM: 'ASFL_FSF_001',
  FSF_FORMAL_NON_BOTTOM: 'ASFL_FSF_002',
  FSF_MISSING_OTHERS: 'ASFL_FSF_003',
  GUI_UNCLOSED_BLOCK: 'GUI_ASFL_001',
  GUI_UNCLOSED_SCREEN: 'GUI_ASFL_002',
  GUI_UNKNOWN_WIDGET: 'GUI_ASFL_003',
  GUI_UNKNOWN_TRIGGER: 'GUI_ASFL_004'
} as const

export function createDiagnostic(
  code: string,
  message: string,
  severity: DiagnosticSeverity,
  span: Span
): Diagnostic {
  return { code, message, severity, span }
}

export function formatDiagnostic(d: Diagnostic, source?: string): string {
  const loc = `${d.span.line}:${d.span.column}`
  let line = `[${d.severity}] ${d.code} at ${loc}: ${d.message}`
  if (source) {
    const lines = source.split(/\r?\n/)
    const srcLine = lines[d.span.line - 1]
    if (srcLine) {
      line += `\n  ${srcLine}\n  ${' '.repeat(Math.max(0, d.span.column - 1))}^`
    }
  }
  return line
}
