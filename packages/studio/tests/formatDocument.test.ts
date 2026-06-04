import { describe, it, expect } from 'vitest'
import { formatDocument } from '@agile-sofl/editor-api'

describe('format document', () => {
  it('formatDocument normalizes module spacing', () => {
    const messy = `module SYSTEM_T;var x:nat;end_module`
    const formatted = formatDocument(messy)
    expect(formatted).toContain('var')
    expect(formatted).toContain('x: nat')
  })
})
