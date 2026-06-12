import { describe, expect, it } from 'vitest'
import { filterDiagnosticsBySelection } from '../src/filterDiagnostics.js'

const modules = [
  {
    name: 'Demo',
    span: { start: 0, end: 200, line: 1, column: 1 },
    processes: [
      {
        name: 'P',
        span: { start: 20, end: 120, line: 2, column: 1 }
      }
    ],
    functions: [
      {
        name: 'f',
        span: { start: 130, end: 190, line: 10, column: 1 }
      }
    ]
  }
]

const diagnostics = [
  { severity: 'error', message: 'in module', span: { start: 5, end: 10, line: 1, column: 5 } },
  { severity: 'error', message: 'in process', span: { start: 50, end: 55, line: 3, column: 1 } },
  { severity: 'warning', message: 'in function', span: { start: 150, end: 155, line: 11, column: 1 } },
  { severity: 'info', message: 'outside', span: { start: 500, end: 505, line: 50, column: 1 } }
]

describe('filterDiagnosticsBySelection', () => {
  it('returns all diagnostics when selection is null', () => {
    expect(filterDiagnosticsBySelection(diagnostics, null, modules)).toHaveLength(4)
  })

  it('filters to module span', () => {
    const result = filterDiagnosticsBySelection(diagnostics, { kind: 'module', moduleName: 'Demo' }, modules)
    expect(result.map((d) => d.message)).toEqual(['in module', 'in process', 'in function'])
  })

  it('filters to process span', () => {
    const result = filterDiagnosticsBySelection(
      diagnostics,
      { kind: 'process', moduleName: 'Demo', processName: 'P' },
      modules
    )
    expect(result.map((d) => d.message)).toEqual(['in process'])
  })

  it('filters to function span', () => {
    const result = filterDiagnosticsBySelection(
      diagnostics,
      { kind: 'function', moduleName: 'Demo', functionName: 'f' },
      modules
    )
    expect(result.map((d) => d.message)).toEqual(['in function'])
  })
})
