import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getDefinition } from '../src/definition.js'
import { resetLspProjectIndex, syncDocument } from '../src/projectIndex.js'

const projectFixtures = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'tests', 'fixtures', 'project')

function doc(source: string, uri: string): TextDocument {
  return TextDocument.create(uri, 'agile-sofl', 1, source)
}

describe('Cross-file definition', () => {
  beforeEach(() => {
    resetLspProjectIndex()
  })

  it('jumps to parent module type in another file', () => {
    const parentUri = 'file:///parent.asfl'
    const childUri = 'file:///child.asfl'
    const parentSource = readFileSync(join(projectFixtures, 'parent.asfl'), 'utf8')
    const childSource = readFileSync(join(projectFixtures, 'child.asfl'), 'utf8')
    syncDocument(doc(parentSource, parentUri))
    const childDoc = doc(childSource, childUri)
    syncDocument(childDoc)
    const idx = childSource.indexOf('Item', childSource.indexOf('var x'))
    const def = getDefinition(childDoc, childDoc.positionAt(idx))
    expect(def).not.toBeNull()
    expect(def!.uri).toBe(parentUri)
  })
})
