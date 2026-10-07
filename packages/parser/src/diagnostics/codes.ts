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
  /** L1: test condition T refers to an output variable. */
  FSF_L1_OUTPUT_IN_TEST: 'ASFL_FSF_101',
  /** L1: defining condition D constrains no output variable. */
  FSF_L1_NO_OUTPUT_IN_DEF: 'ASFL_FSF_102',
  /** L1: check skipped because T/D contains natural-language atoms. */
  FSF_L1_INFORMAL_SKIPPED: 'ASFL_FSF_103',
  /** L1: T refers to a wr external variable without `~` (final value) — use `~x`. */
  FSF_L1_WR_IN_TEST: 'ASFL_FSF_104',
  /** L1: `~x` applied to a variable that is not an ext/state variable (e.g. an input). */
  FSF_L1_OLD_STATE_NON_EXT: 'ASFL_FSF_105',
  FSF_L2_OVERLAP: 'ASFL_FSF_201',
  FSF_L2_INCOMPLETE: 'ASFL_FSF_202',
  FSF_L2_UNKNOWN: 'ASFL_FSF_203',
  FSF_L2_TIMEOUT: 'ASFL_FSF_204',
  FSF_L2_UNSUPPORTED: 'ASFL_FSF_205',
  FSF_L2_INFORMAL: 'ASFL_FSF_206',
  FSF_L2_SKIPPED: 'ASFL_FSF_207',
  FSF_L2_SOLVER_UNAVAILABLE: 'ASFL_FSF_208',
  FSF_L2_COMPLETE_BY_OTHERS: 'ASFL_FSF_209',
  GUI_UNCLOSED_BLOCK: 'GUI_ASFL_001',
  GUI_UNCLOSED_SCREEN: 'GUI_ASFL_002',
  GUI_UNKNOWN_WIDGET: 'GUI_ASFL_003',
  GUI_UNKNOWN_TRIGGER: 'GUI_ASFL_004',
  CDFD_MISSING: 'ASFL_CDFD_001',
  CDFD_UNKNOWN_NODE: 'ASFL_CDFD_002',
  CDFD_UNKNOWN_STORE: 'ASFL_CDFD_003',
  CDFD_UNKNOWN_ENDPOINT: 'ASFL_CDFD_004',
  CDFD_PROCESS_NOT_ON_GRAPH: 'ASFL_CDFD_005',
  CDFD_DUPLICATE: 'ASFL_CDFD_006',
  CDFD_COND_EDGES: 'ASFL_CDFD_007',
  CDFD_COND_OPEN: 'ASFL_CDFD_008',
  CDFD_STORE_EXT: 'ASFL_CDFD_009',
  CDFD_DECOM_UNRESOLVED: 'ASFL_CDFD_010',
  CDFD_DECOM_NOT_MODULE: 'ASFL_CDFD_011',
  CDFD_BOUNDARY: 'ASFL_CDFD_012',
  DATA_GIVEN: 'ASFL_DATA_001',
  DATA_RETRIEVE_MISSING: 'ASFL_DATA_002',
  DATA_RETRIEVE_TYPE: 'ASFL_DATA_003',
  DATA_RETRIEVE_UNDEFINED: 'ASFL_DATA_004',
  DATA_OBLIGATION_OPEN: 'ASFL_DATA_005',
  REFINE_UNLOGGED: 'ASFL_REFINE_001'
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
