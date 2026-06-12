import { describe, expect, it } from 'vitest'
import { mergeDiagnostics, countBySeverity } from '../src/mergeDiagnostics.js'

const span = (line: number, start = line * 10, end = start + 5) => ({
  start,
  end,
  line,
  column: 1
})

describe('mergeDiagnostics', () => {
  it('tags parse and fsf sources', () => {
    const merged = mergeDiagnostics(
      [
        { code: 'ASFL_PARSE_001', message: 'syntax error', severity: 'error', span: span(1) },
        { code: 'ASFL_FSF_001', message: 'informal fsf', severity: 'warning', span: span(2), source: 'fsf' }
      ],
      []
    )
    expect(merged.map((d) => d.source)).toEqual(['parse', 'fsf'])
  })

  it('deduplicates LSP diagnostics that overlap visual parse errors', () => {
    const merged = mergeDiagnostics(
      [{ code: 'ASFL_PARSE_001', message: 'Expecting end', severity: 'error', span: span(3, 30, 40) }],
      [{ code: 'LSP', message: 'Expecting end', severity: 'error', span: span(3, 32, 38) }]
    )
    expect(merged).toHaveLength(1)
    expect(merged[0]?.source).toBe('parse')
  })

  it('keeps distinct LSP diagnostics', () => {
    const merged = mergeDiagnostics(
      [],
      [{ code: 'ASFL_SCOPE_001', message: 'Undefined variable x', severity: 'error', span: span(5) }]
    )
    expect(merged).toHaveLength(1)
    expect(merged[0]?.source).toBe('lsp')
  })

  it('sorts by severity then line', () => {
    const merged = mergeDiagnostics(
      [
        { code: 'A', message: 'info', severity: 'info', span: span(1) },
        { code: 'B', message: 'error', severity: 'error', span: span(10) },
        { code: 'C', message: 'warn', severity: 'warning', span: span(5) }
      ],
      []
    )
    expect(merged.map((d) => d.severity)).toEqual(['error', 'warning', 'info'])
  })
})

describe('countBySeverity', () => {
  it('counts errors warnings and info', () => {
    expect(
      countBySeverity([
        { severity: 'error' },
        { severity: 'error' },
        { severity: 'warning' },
        { severity: 'info' }
      ])
    ).toEqual({ error: 2, warning: 1, info: 1 })
  })
})
