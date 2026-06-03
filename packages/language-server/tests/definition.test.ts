import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getDefinition } from '../src/definition.js'

const bankingPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'tests', 'fixtures', 'integration', 'banking.asfl')

function doc(source: string, uri = 'file:///test.asfl'): TextDocument {
  return TextDocument.create(uri, 'agile-sofl', 1, source)
}

describe('Definition', () => {
  it('jumps to salary var declaration', () => {
    const source = readFileSync(bankingPath, 'utf8')
    const document = doc(source)
    const idx = source.indexOf('salary')
    const def = getDefinition(document, document.positionAt(idx))
    expect(def).not.toBeNull()
  })

  it('jumps to process A from header', () => {
    const source = readFileSync(bankingPath, 'utf8')
    const document = doc(source)
    const idx = source.indexOf('process A')
    const position = document.positionAt(idx + 'process '.length)
    const def = getDefinition(document, position)
    expect(def).not.toBeNull()
  })

  it('jumps to var declaration from FSF reference', () => {
    const source = readFileSync(bankingPath, 'utf8')
    const document = doc(source)
    const fsfIdx = source.indexOf('FSF :')
    const salaryInFsf = source.indexOf('q1', fsfIdx)
    const def = getDefinition(document, document.positionAt(salaryInFsf))
    expect(def).not.toBeNull()
  })

  it('jumps to aliased process P from equal Sub.P', () => {
    const source = `module SYSTEM_Proc;
process Dup equal Sub.P
end_process
end_module;
module Sub / Proc;
process P ()
FSF :
others && true
end_process
end_module`
    const document = doc(source)
    const idx = source.indexOf('Sub.P') + 4
    const def = getDefinition(document, document.positionAt(idx))
    expect(def).not.toBeNull()
    expect(def!.range.start.line).toBeGreaterThanOrEqual(0)
  })

  it('returns null for undefined symbol', () => {
    const source = `module SYSTEM_T;
process P ()
FSF :
others && missingRef > 0
end_process
end_module`
    const document = doc(source)
    const idx = source.indexOf('missingRef')
    const def = getDefinition(document, document.positionAt(idx))
    expect(def).toBeNull()
  })

  it('jumps to parent module type from child module', () => {
    const source = `module SYSTEM_R;
type Item = nat;
end_module;
module Child / R;
var x: Item;
end_module`
    const document = doc(source)
    const idx = source.indexOf('Item', source.indexOf('var x'))
    const def = getDefinition(document, document.positionAt(idx))
    expect(def).not.toBeNull()
  })

  it('returns null when ASFL_PARSE_001 present', () => {
    const source = 'module broken'
    const document = doc(source)
    const def = getDefinition(document, document.positionAt(0))
    expect(def).toBeNull()
  })
})
