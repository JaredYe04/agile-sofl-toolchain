import type { Span } from '@agile-sofl/parser'

export interface SerializableSpan {
  start: number
  end: number
  line: number
  column: number
}

export function toSerializableSpan(span: Span): SerializableSpan {
  return {
    start: span.start,
    end: span.end,
    line: span.line,
    column: span.column
  }
}

export function sliceText(source: string, span: Span): string {
  return source.slice(span.start, span.end)
}
