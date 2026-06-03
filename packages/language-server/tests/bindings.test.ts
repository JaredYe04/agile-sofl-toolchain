import { describe, it, expect } from 'vitest'
import { parse } from '@agile-sofl/parser'
import { bindingAtOffset, bindingNamesAtOffset } from '../src/bindings.js'

describe('Bindings at offset', () => {
  it('collects quantifier binding names', () => {
    const source = `module SYSTEM_Q;
var items: set of nat;
inv
forall[i: items] | i > 0 and
forsome[j: items] | j <> i;
end_module`
    const { ast } = parse(source)
    expect(ast?.type).toBe('program')
    const idx = source.lastIndexOf('i')
    const names = bindingNamesAtOffset(ast!, idx)
    expect(names).toContain('i')
    expect(names).toContain('j')
  })

  it('collects comprehension binding names in set literal', () => {
    const source = `module SYSTEM_C;
process P ()
FSF :
others && 1 inset { n | n: nat & n > 0 }
end_process
end_module`
    const { ast } = parse(source)
    const idx = source.indexOf('n >')
    const names = bindingNamesAtOffset(ast!, idx)
    expect(names).toContain('n')
  })

  it('resolves comprehension binding at name offset', () => {
    const source = `module SYSTEM_C;
process P ()
FSF :
others && [ i | i: int & i > 0 ] = []
end_process
end_module`
    const { ast } = parse(source)
    const idx = source.indexOf('i >')
    const binding = bindingAtOffset(ast!, idx, source)
    expect(binding?.name).toBe('i')
  })
})
