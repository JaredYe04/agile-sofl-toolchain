import { describe, it, expect } from 'vitest'
import { parse } from '@agile-sofl/parser'
import { getInformalSpans } from '../src/patch.js'

const source = `module M;
process P (x: nat) y: nat
    FSF :
    informal test condition && y = 1 ||
    others && y = 0
end_process
end_module;`

describe('getInformalSpans', () => {
  it('includes FSF informal_text spans with field fsf', () => {
    const { ast } = parse(source)
    expect(ast?.type).toBe('program')
    const spans = getInformalSpans(source, ast!)
    expect(spans.some((s) => s.field === 'fsf' && s.text.includes('test condition'))).toBe(true)
  })
})
