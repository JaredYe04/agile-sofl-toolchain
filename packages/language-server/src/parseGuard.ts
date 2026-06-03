/**
 * Guard LSP features when the document has unrecoverable parse errors.
 */

import { parse } from '@agile-sofl/parser'

export function hasParseError(source: string): boolean {
  const { diagnostics } = parse(source)
  return diagnostics.some((d) => d.code === 'ASFL_PARSE_001')
}
