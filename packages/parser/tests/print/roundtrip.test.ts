import { describe, it, expect } from 'vitest'
import { parse, printProgram, normalizeAST, astEqual } from '../../src/index'
import { loadFixture } from '../helpers/index'
import { isProgramNode } from '../../src/ast/guards'

describe('Pretty-printer round-trip', () => {
  it('parse → print → parse preserves structure', () => {
    const source = `module SYSTEM_T;
const n = 42;
type S = set of nat;
var x: S;
end_module`
    const { ast: ast1 } = parse(source)
    expect(ast1).not.toBeNull()
    if (!isProgramNode(ast1)) return

    const printed = printProgram(ast1)
    const { ast: ast2 } = parse(printed)
    expect(ast2).not.toBeNull()
    if (!isProgramNode(ast2)) return

    expect(astEqual(normalizeAST(ast1), normalizeAST(ast2))).toBe(true)
  })

  it('formats minimal module', () => {
    const source = loadFixture('grammar/module/minimal.asfl')
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    const out = printProgram(ast)
    expect(out).toContain('module SYSTEM_Test')
    expect(out).toContain('end_module')
  })
})

describe('Visitor', () => {
  it('walks module nodes', async () => {
    const { walk } = await import('../../src/index')
    const source = loadFixture('grammar/module/minimal.asfl')
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    const visited: string[] = []
    walk(ast, {
      enterModule: (m) => visited.push(m.name)
    })
    expect(visited).toContain('Test')
  })
})
