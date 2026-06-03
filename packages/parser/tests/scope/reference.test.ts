import { describe, it, expect } from 'vitest'
import {
  parse,
  parseSpecification,
  resolveReference,
  resolveDeclarationAtOffset,
  resolveScope
} from '../../src/index'
import { isProgramNode } from '../../src/ast/guards'
import { loadFixture } from '../helpers/index'

function refAt(source: string, needle: string, occurrence = 0): ReturnType<typeof resolveReference> {
  const re = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
  let idx = -1
  for (let i = 0; i <= occurrence; i++) {
    const m = re.exec(source)
    if (!m) throw new Error(`needle not found: ${needle}`)
    idx = m.index
  }
  const { ast } = parse(source)
  if (!isProgramNode(ast)) return null
  const scopeResult = resolveScope(ast)
  return resolveReference(ast, scopeResult, idx)
}

describe('resolveReference', () => {
  it('resolves local var in same module', () => {
    const source = `module SYSTEM_T;
var x: nat;
process P ()
FSF :
others && x > 0
end_process
end_module`
    const target = refAt(source, 'x', 1)
    expect(target?.symbol.name).toBe('x')
    expect(target?.symbol.kind).toBe('var')
    expect(target?.module.name).toBe('T')
  })

  it('resolves type from parent module', () => {
    const source = `module SYSTEM_R;
type Item = nat;
end_module;
module Child / R;
var x: Item;
process P ()
FSF :
others && true
end_process
end_module`
    const target = refAt(source, 'Item', 1)
    expect(target?.symbol.name).toBe('Item')
    expect(target?.symbol.kind).toBe('type')
    expect(target?.module.name).toBe('R')
  })

  it('resolves qualified module.type reference', () => {
    const source = `module SYSTEM_A;
type T = nat;
end_module;
module B / A;
var v: A.T;
end_module`
    const target = refAt(source, 'A.T')
    expect(target?.symbol.name).toBe('T')
    expect(target?.symbol.kind).toBe('type')
    expect(target?.module.name).toBe('A')
  })

  it('resolves cross-module process via field_access Sub.P', () => {
    const source = loadFixture('grammar/processes/ext-alias.asfl')
    const idx = source.indexOf('Sub.P')
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    const scopeResult = resolveScope(ast)
    const target = resolveReference(ast, scopeResult, idx + 4)
    expect(target?.symbol.name).toBe('P')
    expect(target?.symbol.kind).toBe('process')
    expect(target?.module.name).toBe('Sub')
  })

  it('resolves process alias target on equal Sub.P', () => {
    const source = loadFixture('grammar/processes/ext-alias.asfl')
    const idx = source.indexOf('equal Sub.P')
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    const scopeResult = resolveScope(ast)
    const target = resolveReference(ast, scopeResult, idx + 'equal '.length + 2)
    expect(target?.symbol.name).toBe('P')
    expect(target?.symbol.kind).toBe('process')
    expect(target?.module.name).toBe('Sub')
  })

  it('resolves sibling module var via qualified Sibling.local', () => {
    const source = `module SYSTEM_P;
type Shared = nat;
end_module;
module Sibling / P;
var counter: nat;
end_module;
module Other / P;
process Q ()
FSF :
others && Sibling.counter > 0
end_process
end_module`
    const idx = source.indexOf('Sibling.counter') + 'Sibling.'.length
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    const scopeResult = resolveScope(ast)
    const target = resolveReference(ast, scopeResult, idx)
    expect(target?.symbol.name).toBe('counter')
    expect(target?.module.name).toBe('Sibling')
  })

  it('prefers ext rd param over module var with same name', () => {
    const source = `module SYSTEM_E;
var total: nat;
process Worker ()
ext
rd total: int
FSF :
others && total > 0
end_process
end_module`
    const target = refAt(source, 'total', 2)
    expect(target?.symbol.name).toBe('total')
    expect(target?.span.start).toBeGreaterThan(source.indexOf('rd total'))
  })

  it('prefers ext wr param over module var', () => {
    const source = `module SYSTEM_E;
var subtotal: int;
process Worker ()
ext
wr subtotal: nat
FSF :
others && subtotal = 1
end_process
end_module`
    const target = refAt(source, 'subtotal', 2)
    expect(target?.symbol.name).toBe('subtotal')
    expect(target?.span.start).toBeGreaterThan(source.indexOf('wr subtotal'))
  })

  it('prefers process input param over module var', () => {
    const source = `module SYSTEM_E;
var x: nat;
process P (x: int) y: nat
FSF :
others && x > 0
end_process
end_module`
    const target = refAt(source, 'x', 2)
    expect(target?.symbol.name).toBe('x')
    expect(target?.span.start).toBeGreaterThan(source.indexOf('process P'))
  })

  it('prefers process output param over module var', () => {
    const source = `module SYSTEM_E;
var y: nat;
process P () y: int
FSF :
others && y > 0
end_process
end_module`
    const target = refAt(source, 'y', 1)
    expect(target?.symbol.name).toBe('y')
  })

  it('resolves process declaration at header', () => {
    const source = `module SYSTEM_P;
process Alpha ()
FSF :
others && true
end_process
end_module`
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    const scopeResult = resolveScope(ast)
    const idx = source.indexOf('process Alpha') + 'process '.length
    const target = resolveDeclarationAtOffset(ast, scopeResult, idx)
    expect(target?.symbol.kind).toBe('process')
    expect(target?.symbol.name).toBe('Alpha')
  })

  it('resolves function declaration at header', () => {
    const source = `module SYSTEM_F;
function f(x: nat): nat
== undefined
end_function
end_module`
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    const scopeResult = resolveScope(ast)
    const idx = source.indexOf('function f') + 'function '.length
    const target = resolveDeclarationAtOffset(ast, scopeResult, idx)
    expect(target?.symbol.kind).toBe('function')
  })

  it('resolves const in same module', () => {
    const source = `module SYSTEM_C;
const limit = 10;
process P ()
FSF :
others && limit > 0
end_process
end_module`
    const target = refAt(source, 'limit', 1)
    expect(target?.symbol.kind).toBe('const')
  })

  it('returns null for undefined symbol', () => {
    const source = `module SYSTEM_U;
process P ()
FSF :
others && noSuchSymbol > 0
end_process
end_module`
    const target = refAt(source, 'noSuchSymbol')
    expect(target).toBeNull()
  })

  it('returns null for unknown qualified module', () => {
    const source = `module SYSTEM_U;
var x: Ghost.T;
end_module`
    const target = refAt(source, 'Ghost.T')
    expect(target).toBeNull()
  })

  it('returns null for unknown symbol in qualified module', () => {
    const source = `module SYSTEM_A;
type T = nat;
end_module;
module B / A;
var x: A.Missing;
end_module`
    const target = refAt(source, 'A.Missing')
    expect(target).toBeNull()
  })

  it('returns null outside any module', () => {
    const source = 'not a module'
    const { ast } = parseSpecification(source)
    if (!isProgramNode(ast)) return
    const scopeResult = resolveScope(ast)
    expect(resolveReference(ast, scopeResult, 0)).toBeNull()
  })

  it('does not resolve type name as reference at declaration', () => {
    const source = `module SYSTEM_T;
type Foo = nat;
end_module`
    const idx = source.indexOf('type Foo') + 'type '.length
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    const scopeResult = resolveScope(ast)
    expect(resolveReference(ast, scopeResult, idx)).toBeNull()
    expect(resolveDeclarationAtOffset(ast, scopeResult, idx)?.symbol.name).toBe('Foo')
  })

  it('resolves banking salary from integration fixture', () => {
    const source = loadFixture('integration/banking.asfl')
    const target = refAt(source, 'salary')
    expect(target?.symbol.name).toBe('salary')
    expect(target?.symbol.kind).toBe('var')
  })

  it('resolves ext rd name in ext-alias fixture', () => {
    const source = loadFixture('grammar/processes/ext-alias.asfl')
    const target = refAt(source, 'total', 1)
    expect(target?.symbol.name).toBe('total')
  })
})
