import type { SerializableSpan } from '../../preload/index'

export type RevealSpanFn = (span: SerializableSpan) => void

/** Bridges visual selection / diagnostics to Monaco reveal + highlight. */
export function useCodeNavigation(revealSpan: RevealSpanFn) {
  function navigateToSpan(span: SerializableSpan): void {
    revealSpan(span)
  }

  function navigateToLine(line: number, column = 1): void {
    revealSpan({ start: 0, end: 0, line, column })
  }

  return { navigateToSpan, navigateToLine }
}
