export const DiagnosticCodes = {
  PARSE_ERROR: 'GUI_PARSE_001',
  SCHEMA_ERROR: 'GUI_SCHEMA_001',
  STYLE_NO_SCREEN_CONTENT: 'GUI_STYLE_001',
  STYLE_UNKNOWN_PROCESS: 'GUI_STYLE_002',
  STYLE_UNKNOWN_FLOW_SCREEN: 'GUI_STYLE_003',
  STYLE_DUPLICATE_ID: 'GUI_STYLE_004'
} as const

export function createDiagnostic(
  code: string,
  message: string,
  severity: 'error' | 'warning' | 'info',
  path?: string
) {
  return { code, message, severity, path }
}
