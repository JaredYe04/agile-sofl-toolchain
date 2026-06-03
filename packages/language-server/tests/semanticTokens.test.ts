import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { buildSemanticTokenRecords, formatSemanticTokenRecords } from '../src/semanticTokens.js'

const parserRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'parser')
const monorepoRoot = join(parserRoot, '..', '..')

describe('Semantic tokens', () => {
  it('marks informal text using AST spans', () => {
    const source = `module SYSTEM_P;
process P ()
FSF :
informal requirement && y = 1
end_process
end_module`
    const records = buildSemanticTokenRecords(source)
    expect(records.some((r) => r.type === 'string' && r.text?.includes('informal'))).toBe(true)
  })

  it('marks SYSTEM_ prefix and module name from nameSpan', () => {
    const source = readFileSync(join(monorepoRoot, 'examples', 'keyword-traps.asfl'), 'utf8')
    const records = buildSemanticTokenRecords(source)
    expect(records.some((r) => r.type === 'keyword' && r.text === 'SYSTEM_')).toBe(true)
    expect(records.some((r) => r.type === 'namespace' && r.text === 'Traps')).toBe(true)
  })

  it('marks process param names from nameSpans', () => {
    const source = readFileSync(join(parserRoot, 'tests', 'fixtures', 'integration', 'banking.asfl'), 'utf8')
    const records = buildSemanticTokenRecords(source)
    expect(records.some((r) => r.type === 'parameter' && r.text === 'x')).toBe(true)
    expect(records.some((r) => r.type === 'parameter' && r.text === 'q1')).toBe(true)
  })

  it('formats records for snapshot-style assertions', () => {
    const source = 'module SYSTEM_T; var x: nat; end_module'
    const formatted = formatSemanticTokenRecords(buildSemanticTokenRecords(source))
    expect(formatted.some((l) => l.includes('type=namespace'))).toBe(true)
    expect(formatted.some((l) => l.includes('type=variable'))).toBe(true)
  })

  it('marks informal keyword in comment from text span', () => {
    const source = readFileSync(join(monorepoRoot, 'examples', 'highlight-edge-cases.asfl'), 'utf8')
    const records = buildSemanticTokenRecords(source)
    expect(records.some((r) => r.type === 'keyword' && r.text === 'informal')).toBe(true)
  })
})
