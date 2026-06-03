import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { collectWorkspaceSymbols } from '../src/workspaceSymbols.js'

const bankingPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'tests', 'fixtures', 'integration', 'banking.asfl')

function doc(source: string): TextDocument {
  return TextDocument.create('file:///banking.asfl', 'agile-sofl', 1, source)
}

describe('Workspace symbols', () => {
  it('lists module and process names', () => {
    const source = readFileSync(bankingPath, 'utf8')
    const symbols = collectWorkspaceSymbols(doc(source))
    expect(symbols.some((s) => s.name === 'SYSTEM_Banking')).toBe(true)
    expect(symbols.some((s) => s.name === 'A')).toBe(true)
    expect(symbols.some((s) => s.name === 'salary')).toBe(true)
  })

  it('filters by query', () => {
    const source = readFileSync(bankingPath, 'utf8')
    const symbols = collectWorkspaceSymbols(doc(source), 'sal')
    expect(symbols.every((s) => s.name.toLowerCase().includes('sal'))).toBe(true)
    expect(symbols.some((s) => s.name === 'salary')).toBe(true)
  })

  it('includes containerName for nested symbols', () => {
    const source = readFileSync(bankingPath, 'utf8')
    const symbols = collectWorkspaceSymbols(doc(source), 'A')
    const proc = symbols.find((s) => s.name === 'A')
    expect(proc?.containerName).toBe('SYSTEM_Banking')
  })
})
