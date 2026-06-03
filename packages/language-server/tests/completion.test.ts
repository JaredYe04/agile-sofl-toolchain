import { describe, it, expect } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { CompletionItemKind } from 'vscode-languageserver/node.js'
import { getCompletions } from '../src/completion.js'
function doc(source: string): TextDocument {
  return TextDocument.create('file:///test.asfl', 'agile-sofl', 1, source)
}

describe('Completion', () => {
  it('offers parent module type in child module', () => {
    const source = `module SYSTEM_R;
type Item = nat;
end_module;
module Child / R;
var x: I`
    const document = doc(source)
    const idx = source.lastIndexOf('I')
    const items = getCompletions(document, document.positionAt(idx))
    expect(items.some((i) => i.label === 'Item')).toBe(true)
  })

  it('offers process parameter names in FSF body', () => {
    const source = `module SYSTEM_T;
process P (x: nat) ok: nat
FSF :
x > 0 && ok = `
    const document = doc(source)
    const idx = source.length
    const items = getCompletions(document, document.positionAt(idx))
    expect(items.some((i) => i.label === 'x')).toBe(true)
    expect(items.some((i) => i.label === 'ok')).toBe(true)
  })

  it('offers quantifier bindings after bracket', () => {
    const source = `module SYSTEM_Q;
var items: set of nat;
inv
forevery[i: items] | i > 0 and
forsome[j: items] | j <> i`
    const document = doc(source)
    const idx = source.lastIndexOf('i')
    const items = getCompletions(document, document.positionAt(idx))
    expect(items.some((i) => i.label === 'i')).toBe(true)
    expect(items.some((i) => i.label === 'j')).toBe(true)
  })

  it('scopes symbols to nested module not root only', () => {
    const source = `module SYSTEM_A;
var rootVar: nat;
end_module;
module B / A;
var localVar: nat;
process P ()
FSF :
localVar > `
    const document = doc(source)
    const idx = source.length
    const items = getCompletions(document, document.positionAt(idx))
    expect(items.some((i) => i.label === 'localVar')).toBe(true)
    expect(items.some((i) => i.label === 'rootVar')).toBe(true)
  })

  it('offers ext variable names inside process', () => {
    const source = `module SYSTEM_T;
process P ()
ext
rd total: nat
FSF :
total > `
    const document = doc(source)
    const idx = source.length
    const items = getCompletions(document, document.positionAt(idx))
    expect(items.some((i) => i.label === 'total')).toBe(true)
  })

  it('offers user-defined functions with Function kind', () => {
    const source = `module SYSTEM_F;
function add (x: nat, y: nat): nat
== x + y
end_function
process P (a: nat) ok: nat
FSF :
others && ok = `
    const document = doc(source)
    const idx = source.length
    const items = getCompletions(document, document.positionAt(idx))
    const addItem = items.find((i) => i.label === 'add')
    expect(addItem?.kind).toBe(CompletionItemKind.Function)
  })

  it('offers comprehension bindings inside set guard', () => {
    const source = `module SYSTEM_C;
process P ()
FSF :
others && 1 inset { n | n: nat & n > 0 }
end_process
end_module`
    const document = doc(source)
    const idx = source.indexOf('n > 0')
    const items = getCompletions(document, document.positionAt(idx))
    expect(items.some((i) => i.label === 'n')).toBe(true)
  })
})
