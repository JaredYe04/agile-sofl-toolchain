import { describe, it, expect } from 'vitest'
import { buildDocumentModel } from '@agile-sofl/editor-api'

describe('studio contract smoke', () => {
  it('buildDocumentModel returns modules from sample spec', () => {
    const source = 'module SYSTEM_T;\nvar x: nat;\nend_module'
    const model = buildDocumentModel(source)
    expect(model.modules.some((m) => m.name === 'SYSTEM_T')).toBe(true)
  })
})
