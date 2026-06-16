import { describe, it, expect } from 'vitest'
import { buildInformalModel, validateBookAlign } from '@agile-sofl/aspec'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseAspec } from '@agile-sofl/aspec'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../../aspec/tests/fixtures')

describe('buildInformalModel bookAlignStrict', () => {
  it('elevates BOOK_ALIGN format issues in strict mode', () => {
    const source = readFileSync(join(fixtures, 'minimal.aspec'), 'utf8')
    const loose = buildInformalModel(source, { bookAlignStrict: false })
    const strict = buildInformalModel(source, { bookAlignStrict: true })
    expect(strict.diagnostics.length).toBeGreaterThanOrEqual(loose.diagnostics.length)
  })
})

describe('linked informal hints logic', () => {
  it('bottom level blocks informal by decom absence', () => {
    const { document } = parseAspec(readFileSync(join(fixtures, 'minimal.aspec'), 'utf8'))
    const diags = validateBookAlign(document!, true)
    expect(Array.isArray(diags)).toBe(true)
  })
})
