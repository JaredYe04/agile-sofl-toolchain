import { describe, it, expect } from 'vitest'
import { check } from '../../src/index'
import { resolveScope, lookupSymbol, checkVarWriteAccess } from '../../src/scope/resolver'
import { isProgramNode } from '../../src/ast/guards'

describe('Scope resolver extras', () => {
  it('lookupSymbol walks parent scopes', () => {
    const source = `module SYSTEM_R;
type Item = nat;
var secret: nat;
end_module;
module Child / R;
var x: Item;
end_module`
    const { ast } = check(source)
    if (!isProgramNode(ast)) return
    const { root } = resolveScope(ast)
    expect(root).not.toBeNull()
    if (!root) return
    expect(lookupSymbol(root, 'Item')?.kind).toBe('type')
    expect(lookupSymbol(root.children[0], 'Item')?.kind).toBe('type')
  })

  it('checkVarWriteAccess flags cross-module write', () => {
    const source = `module SYSTEM_R;
var secret: nat;
end_module;
module Child / R;
process P ()
ext
wr secret: nat
FSF :
true && secret = 1
end_process
end_module`
    const { ast } = check(source)
    if (!isProgramNode(ast)) return
    const diag = checkVarWriteAccess(ast, 'secret', 'Child')
    expect(diag?.code).toBe('ASFL_SCOPE_003')
  })
})
