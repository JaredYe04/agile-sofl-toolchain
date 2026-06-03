import { describe, it, expect } from 'vitest'
import { checkIncremental, getChangedModules, moduleSourceHashes } from '../../src/parser/incremental.js'
import { parse } from '../../src/index.js'

describe('checkIncremental', () => {
  const source = `module SYSTEM_A;
var x: nat;
end_module;
module SYSTEM_B;
var y: nat;
end_module`

  it('returns cached result when source unchanged', () => {
    const first = checkIncremental(source)
    const second = checkIncremental(source, first.state)
    expect(second.state).toBe(first.state)
    expect(second.ast).toBe(first.ast)
  })

  it('recomputes when source changes', () => {
    const first = checkIncremental(source)
    const edited = source.replace('var y: nat', 'var y: int')
    const second = checkIncremental(edited, first.state)
    expect(second.state.contentHash).not.toBe(first.state.contentHash)
    expect(second.diagnostics).toBeDefined()
  })

  it('tracks per-module hashes', () => {
    const { ast } = parse(source)
    expect(ast?.type).toBe('program')
    if (ast?.type === 'program') {
      const hashes = moduleSourceHashes(source, ast)
      expect(Object.keys(hashes)).toEqual(expect.arrayContaining(['A', 'B']))
    }
  })

  it('getChangedModules reports edited module only', () => {
    const first = checkIncremental(source)
    const edited = source.replace('var y: nat', 'var y: int')
    const { ast } = parse(edited)
    if (ast?.type === 'program') {
      const changed = getChangedModules(edited, ast, first.state)
      expect(changed).toContain('B')
      expect(changed).not.toContain('A')
    }
  })
})
