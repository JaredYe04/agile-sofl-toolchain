import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getHover } from '../src/hover.js'

const bankingPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'tests', 'fixtures', 'integration', 'banking.asfl')

function doc(source: string, uri = 'file:///test.asfl'): TextDocument {
  return TextDocument.create(uri, 'agile-sofl', 1, source)
}

describe('Hover', () => {
  it('includes type for var salary', () => {
    const source = readFileSync(bankingPath, 'utf8')
    const document = doc(source)
    const idx = source.indexOf('salary')
    const hover = getHover(document, document.positionAt(idx))
    const text = typeof hover!.contents === 'string' ? hover!.contents : hover!.contents.value
    expect(text).toContain('var')
    expect(text).toContain('salary')
    expect(text).toContain('type')
    expect(text).toContain('nat')
  })

  it('shows process I/O and FSF count', () => {
    const source = readFileSync(bankingPath, 'utf8')
    const document = doc(source)
    const idx = source.indexOf('process A') + 'process '.length
    const hover = getHover(document, document.positionAt(idx))
    const text = typeof hover!.contents === 'string' ? hover!.contents : hover!.contents.value
    expect(text).toContain('process')
    expect(text).toContain('inputs')
    expect(text).toContain('FSF')
  })

  it('shows informal predicate template', () => {
    const source = `module SYSTEM_P;
process P ()
FSF :
informal requirement && y = 1
end_process
end_module`
    const document = doc(source)
    const idx = source.indexOf('informal requirement')
    const hover = getHover(document, document.positionAt(idx))
    const text = typeof hover!.contents === 'string' ? hover!.contents : hover!.contents.value
    expect(text).toContain('informal')
    expect(text).toContain('requirement')
  })

  it('shows comment field template', () => {
    const source = readFileSync(bankingPath, 'utf8')
    const document = doc(source)
    const idx = source.indexOf('informal note')
    const hover = getHover(document, document.positionAt(idx))
    const text = typeof hover!.contents === 'string' ? hover!.contents : hover!.contents.value
    expect(text).toContain('comment')
    expect(text).toContain('informal note')
  })

  it('returns null when ASFL_PARSE_001 present', () => {
    const source = 'module broken'
    const document = doc(source)
    const hover = getHover(document, document.positionAt(0))
    expect(hover).toBeNull()
  })

  it('shows function signature', () => {
    const source = `module SYSTEM_F;
function add (x: nat, y: nat): nat
== x + y
end_function
end_module`
    const document = doc(source)
    const idx = source.indexOf('add')
    const hover = getHover(document, document.positionAt(idx))
    const text = typeof hover!.contents === 'string' ? hover!.contents : hover!.contents.value
    expect(text).toContain('function')
    expect(text).toContain('signature')
    expect(text).toContain('nat')
  })

  it('shows user function signature at call site', () => {
    const source = `module SYSTEM_F;
process P (a: nat) ok: nat
FSF :
others && ok = add(a, 1)
end_process
function add (x: nat, y: nat): nat
== x + y
end_function
end_module`
    const document = doc(source)
    const idx = source.indexOf('add(a')
    const hover = getHover(document, document.positionAt(idx))
    const text = typeof hover!.contents === 'string' ? hover!.contents : hover!.contents.value
    expect(text).toContain('function')
    expect(text).toContain('add')
    expect(text).toContain('signature')
  })

  it('shows comprehension binding type', () => {
    const source = `module SYSTEM_C;
process P ()
FSF :
others && 1 inset { n | n: nat & n mod 2 = 0 }
end_process
end_module`
    const document = doc(source)
    const guardIdx = source.indexOf('n mod')
    const hover = getHover(document, document.positionAt(guardIdx))
    const text = typeof hover!.contents === 'string' ? hover!.contents : hover!.contents.value
    expect(text).toContain('comprehension binding')
    expect(text).toContain('n')
    expect(text).toContain('nat')
  })
})
