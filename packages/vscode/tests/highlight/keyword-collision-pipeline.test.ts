import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tokenize } from '../../../parser/src/lexer/lexer.js'
import { parse } from '../../../parser/src/parser/parse.js'
import { highlightSource, assertIdentifierNotSplit } from '../../scripts/highlight-lib.mjs'

const monorepoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const matrix = JSON.parse(
  readFileSync(
    join(monorepoRoot, 'packages', 'parser', 'tests', 'fixtures', 'keyword-collision-matrix.json'),
    'utf-8'
  )
) as Array<{ identifier: string; minParse: boolean }>

function miniModule(identifier: string): string {
  return `module SYSTEM_Pipeline;
var ${identifier}: nat;
end_module`
}

describe('Keyword collision pipeline', () => {
  it.each(matrix)('lexer/parse/highlight agree for $identifier', async ({ identifier, minParse }) => {
    const source = miniModule(identifier)
    const { tokens } = tokenize(source)
    const idTokens = tokens.filter((t) => t.image === identifier)
    expect(idTokens.length).toBeGreaterThan(0)
    for (const t of idTokens) {
      expect(t.tokenType.name).toBe('Identifier')
    }

    const result = parse(source)
    if (minParse) {
      expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
      expect(result.ast).not.toBeNull()
    }

    const highlighted = await highlightSource(source)
    assertIdentifierNotSplit(highlighted, identifier, ['entityType', 'param', 'identifier'])
  })
})
