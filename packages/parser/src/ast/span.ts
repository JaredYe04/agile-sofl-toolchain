/**
 * Source location span for editor/LSP integration.
 */
export interface Span {
  start: number
  end: number
  line: number
  column: number
}

export const EMPTY_SPAN: Span = { start: 0, end: 0, line: 1, column: 1 }

export function spanFromToken(
  startOffset: number,
  endOffset: number,
  startLine: number,
  startColumn: number
): Span {
  return { start: startOffset, end: endOffset, line: startLine, column: startColumn }
}

export function mergeSpans(a: Span, b: Span): Span {
  return {
    start: Math.min(a.start, b.start),
    end: Math.max(a.end, b.end),
    line: a.line,
    column: a.column
  }
}
