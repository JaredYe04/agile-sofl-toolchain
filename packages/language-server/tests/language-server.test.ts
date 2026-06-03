import { describe, it, expect } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { collectDiagnostics } from '../src/diagnostics.js'
import { formatDocument } from '../src/formatting.js'
import { SymbolKind } from 'vscode-languageserver/node.js'
import { collectDocumentSymbols } from '../src/symbols.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const bankingPath = join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'integration', 'banking.asfl')

function doc(source: string, uri = 'file:///test.asfl'): TextDocument {
  return TextDocument.create(uri, 'agile-sofl', 1, source)
}

describe('Language server', () => {
  it('collects no errors for banking fixture', () => {
    const source = readFileSync(bankingPath, 'utf8')
    const diagnostics = collectDiagnostics(doc(source))
    expect(diagnostics.filter((d) => d.severity === 1)).toHaveLength(0)
  })

  it('reports parse errors for broken module', () => {
    const diagnostics = collectDiagnostics(doc('module broken'))
    expect(diagnostics.length).toBeGreaterThan(0)
  })

  it('formats minimal module', () => {
    const source = 'module SYSTEM_T; var x: nat; end_module'
    const edits = formatDocument(doc(source))
    expect(edits.length).toBeGreaterThan(0)
    expect(edits[0].newText).toContain('module SYSTEM_T')
  })
})

describe('Document symbols', () => {
  it('includes FSF and comment children under process', () => {
    const source = readFileSync(bankingPath, 'utf8')
    const symbols = collectDocumentSymbols(doc(source))
    const proc = symbols[0].children?.find((c) => c.name === 'A' && c.kind === SymbolKind.Method)
    expect(proc?.children?.some((c) => c.name === 'FSF')).toBe(true)
    expect(proc?.children?.some((c) => c.name === 'comment')).toBe(true)
  })
})
