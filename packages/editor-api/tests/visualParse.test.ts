import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildVisualModelTolerant } from '../src/visualParse.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../parser/tests/fixtures/grammar')

function loadFixture(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

describe('buildVisualModelTolerant', () => {
  it('returns modules when tolerant parse recovers partial AST', () => {
    const source = loadFixture('negative/unclosed-process.asfl')
    const result = buildVisualModelTolerant(source)
    expect(result.parseFailed).toBe(false)
    expect(result.hasDiagnostics).toBe(true)
    expect(result.modules.length).toBeGreaterThan(0)
    expect(result.moduleGraph?.nodes.length).toBeGreaterThan(0)
  })

  it('marks hasDiagnostics when parse errors exist', () => {
    const source = loadFixture('negative/unclosed-process.asfl')
    const result = buildVisualModelTolerant(source)
    expect(result.hasDiagnostics).toBe(true)
    expect(result.parseFailed).toBe(false)
  })
})
