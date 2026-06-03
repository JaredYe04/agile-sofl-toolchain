import { describe, it, expect } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { spanToRange } from '../src/position.js'
import { diagnosticToLsp } from '../src/lsp-utils.js'

describe('spanToRange', () => {
  it('uses document.positionAt for multi-line spans', () => {
    const source = 'line1\nline2 text'
    const document = TextDocument.create('file:///t.asfl', 'agile-sofl', 1, source)
    const range = spanToRange(document, { start: 7, end: 12, line: 2, column: 1 })
    expect(range.start.line).toBe(1)
    expect(range.end.character).toBeGreaterThan(0)
  })

  it('diagnostics use unified spanToRange', () => {
    const source = 'module broken'
    const document = TextDocument.create('file:///t.asfl', 'agile-sofl', 1, source)
    const diag = diagnosticToLsp(
      {
        code: 'ASFL_PARSE_001',
        message: 'parse error',
        severity: 'error',
        span: { start: 0, end: 6, line: 1, column: 1 }
      },
      document
    )
    expect(diag.range.start.line).toBe(0)
    expect(diag.range.end.character).toBeGreaterThan(0)
  })
})
