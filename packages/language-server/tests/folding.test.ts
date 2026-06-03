import { describe, it, expect } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { collectFoldingRanges } from '../src/folding.js'

function doc(source: string): TextDocument {
  return TextDocument.create('file:///test.asfl', 'agile-sofl', 1, source)
}

describe('Folding ranges', () => {
  it('folds module body', () => {
    const source = `module SYSTEM_T;
var x: nat;
process P ()
FSF :
others && true
end_process
end_module`
    const document = doc(source)
    const ranges = collectFoldingRanges(document)
    expect(ranges.length).toBeGreaterThanOrEqual(2)
    expect(ranges.some((r) => r.startLine === 0)).toBe(true)
  })

  it('folds FSF block inside process', () => {
    const source = `module SYSTEM_T;
process P ()
FSF :
x > 0 && y = 1 ||
others && y = 0
end_process
end_module`
    const document = doc(source)
    const ranges = collectFoldingRanges(document)
    expect(ranges.some((r) => r.endLine > r.startLine)).toBe(true)
  })

  it('folds function body', () => {
    const source = `module SYSTEM_F;
function f (x: nat): nat
== x
end_function
end_module`
    const document = doc(source)
    const ranges = collectFoldingRanges(document)
    expect(ranges.length).toBeGreaterThanOrEqual(2)
  })
})
