import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildSemanticTokenRecords,
  formatSemanticTokenRecords
} from '../../packages/language-server/src/semanticTokens.ts'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function loadExample(name: string): string {
  return readFileSync(join(repoRoot, 'examples', `${name}.asfl`), 'utf-8')
}

describe('Semantic highlight', () => {
  it('marks informal text in FSF', () => {
    const source = `module SYSTEM_P;
process P ()
FSF :
informal requirement && y = 1
end_process
end_module`
    const records = buildSemanticTokenRecords(source)
    const formatted = formatSemanticTokenRecords(records)
    expect(records.some((r) => r.type === 'string' && r.text?.includes('informal'))).toBe(true)
    expect(formatted.some((l) => l.includes('type=string'))).toBe(true)
  })

  it('marks module and process names', () => {
    const source = loadExample('keyword-traps')
    const records = buildSemanticTokenRecords(source)
    expect(records.some((r) => r.type === 'namespace' && r.text === 'SYSTEM_Traps')).toBe(false)
    expect(records.some((r) => r.type === 'keyword' && r.text === 'SYSTEM_')).toBe(true)
    expect(records.some((r) => r.type === 'namespace' && r.text === 'Traps')).toBe(true)
    expect(records.some((r) => r.type === 'variable' && r.text === 'total')).toBe(true)
  })

  it('marks informal keyword in comment line', () => {
    const source = loadExample('highlight-edge-cases')
    const records = buildSemanticTokenRecords(source)
    expect(records.some((r) => r.type === 'keyword' && r.text === 'informal')).toBe(true)
  })
})
