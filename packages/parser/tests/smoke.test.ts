import { describe, it, expect } from 'vitest'
import { parseSpecification } from '@/index'

describe('Smoke test', () => {
  it('exports parse API', () => {
    const { ast } = parseSpecification('module SYSTEM_X;\nend_module')
    expect(ast).not.toBeNull()
  })
})
