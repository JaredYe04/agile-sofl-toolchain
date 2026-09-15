import { describe, expect, it } from 'vitest'
import { validateInformalDuplicateNames } from '../src/informal/duplicateNames.js'
import { DiagnosticCodes } from '../src/diagnostics/codes.js'
import { buildInformalModel } from '../src/buildInformalModel.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

describe('informal duplicate names', () => {
  it('detects duplicate process names in a module', () => {
    const diags = validateInformalDuplicateNames([
      {
        id: 'mod1',
        name: 'Auth',
        description: 'auth',
        processes: [
          { id: 'p1', name: 'Login', description: 'a' },
          { id: 'p2', name: 'Login', description: 'b' }
        ]
      }
    ])
    expect(diags.some((d) => d.code === DiagnosticCodes.STYLE_DUPLICATE_NAME)).toBe(true)
  })

  it('is included in buildInformalModel diagnostics', () => {
    const source = readFileSync(join(fixtures, 'minimal.aspec'), 'utf8')
    const model = buildInformalModel(source)
    expect(model.diagnostics.filter((d) => d.code === DiagnosticCodes.STYLE_DUPLICATE_NAME)).toHaveLength(0)
  })
})
