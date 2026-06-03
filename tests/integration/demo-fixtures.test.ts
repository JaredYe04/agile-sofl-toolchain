import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { check } from '../../src/index'
import { loadFixture } from '../helpers/index'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function loadExample(name: string): string {
  return readFileSync(join(repoRoot, 'examples', `${name}.asfl`), 'utf-8')
}

const demoFiles = [
  'library-system',
  'ecommerce',
  'hospital-registration',
  'keyword-traps',
  'highlight-edge-cases',
  'type-showcase'
] as const

describe('Integration - example demos', () => {
  for (const name of demoFiles) {
    it(`parses and type-checks examples/${name}.asfl`, () => {
      const source = loadExample(name)
      const { ast, diagnostics } = check(source)
      expect(ast).not.toBeNull()
      expect(ast!.modules.length).toBeGreaterThan(0)
      expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    })
  }

  it('banking fixture still passes full pipeline', () => {
    const source = loadFixture('integration/banking.asfl')
    const { diagnostics } = check(source)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })
})
