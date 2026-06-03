import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getDefinition } from '../src/definition.js'
import { getHover } from '../src/hover.js'
import { getCompletions } from '../src/completion.js'

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
})

describe('Hover', () => {
  it('shows symbol kind for salary', () => {
    const source = readFileSync(bankingPath, 'utf8')
    const document = doc(source)
    const idx = source.indexOf('salary')
    const hover = getHover(document, document.positionAt(idx))
    expect(hover?.contents).toBeDefined()
    const text = typeof hover!.contents === 'string' ? hover!.contents : hover!.contents.value
    expect(text).toContain('var')
    expect(text).toContain('salary')
  })
})

describe('Completion', () => {
  it('offers nat after colon in var decl', () => {
    const source = 'module SYSTEM_T;\nvar x: n'
    const document = doc(source)
    const colonIdx = source.lastIndexOf(':')
    const items = getCompletions(document, document.positionAt(colonIdx + 2))
    expect(items.some((i) => i.label === 'nat')).toBe(true)
  })

  it('offers defined type names in type position', () => {
    const source = 'module SYSTEM_T;\ntype T = nat;\nvar x: '
    const document = doc(source)
    const items = getCompletions(document, document.positionAt(source.length))
    expect(items.some((i) => i.label === 'T')).toBe(true)
  })
})
