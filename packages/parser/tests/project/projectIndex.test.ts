import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { ProjectIndex } from '../../src/project/projectIndex.js'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const projectFixtures = join(repoRoot, 'tests', 'fixtures', 'project')

function readFixture(name: string): string {
  return readFileSync(join(projectFixtures, name), 'utf-8')
}

describe('ProjectIndex', () => {
  let index: ProjectIndex

  beforeEach(() => {
    index = new ProjectIndex()
  })

  it('upsert caches document by content hash', () => {
    const uri = 'file:///a.asfl'
    const source = 'module SYSTEM_T;\nvar x: nat;\nend_module'
    const first = index.upsert(uri, source)
    const second = index.upsert(uri, source)
    expect(second).toBe(first)
  })

  it('scan indexes .asfl files from directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'asfl-index-'))
    writeFileSync(join(dir, 'one.asfl'), 'module SYSTEM_O;\nend_module')
    mkdirSync(join(dir, 'nested'))
    writeFileSync(join(dir, 'nested', 'two.asfl'), 'module SYSTEM_T;\nend_module')
    index.scan(dir)
    expect(index.documents()).toHaveLength(2)
  })

  it('symbols returns module and declaration entries', () => {
    index.upsert(
      'file:///m.asfl',
      `module SYSTEM_S;
const c = 1;
type T = nat;
var v: T;
process P ()
FSF :
others && true
end_process
end_module`
    )
    const syms = index.symbols()
    expect(syms.some((s) => s.kind === 'module' && s.name === 'SYSTEM_S')).toBe(true)
    expect(syms.some((s) => s.kind === 'const' && s.name === 'c')).toBe(true)
    expect(syms.some((s) => s.kind === 'process' && s.name === 'P')).toBe(true)
  })

  it('symbols filters by query', () => {
    index.upsert('file:///m.asfl', 'module SYSTEM_Alpha;\nend_module')
    expect(index.symbols('alpha')).toHaveLength(1)
    expect(index.symbols('missing')).toHaveLength(0)
  })

  it('mergedScope indexes modules from multiple documents', () => {
    index.upsert(
      'file:///parent.asfl',
      'module SYSTEM_R;\ntype Item = nat;\nend_module'
    )
    index.upsert(
      'file:///child.asfl',
      'module SYSTEM_C;\nvar x: R.Item;\nend_module'
    )
    const scope = index.mergedScope()
    expect(scope?.scopes.has('R')).toBe(true)
    expect(scope?.scopes.has('C')).toBe(true)
  })

  it('findDefinition resolves symbol in same document', () => {
    const source = `module SYSTEM_T;
var salary: nat;
process P ()
FSF :
others && salary > 0
end_process
end_module`
    const uri = 'file:///t.asfl'
    index.upsert(uri, source)
    const idx = source.indexOf('salary', source.indexOf('FSF'))
    const def = index.findDefinition(uri, idx)
    expect(def?.uri).toBe(uri)
    expect(def?.target.symbol.name).toBe('salary')
  })

  it('findDefinition resolves parent type across files', () => {
    const parentUri = pathToFileURL(join(repoRoot, 'tests', 'fixtures', 'project', 'parent.asfl')).href
    const childUri = pathToFileURL(join(repoRoot, 'tests', 'fixtures', 'project', 'child.asfl')).href
    index.upsert(
      parentUri,
      readFixture('parent.asfl')
    )
    index.upsert(
      childUri,
      readFixture('child.asfl')
    )
    const childSource = readFixture('child.asfl')
    const idx = childSource.indexOf('Item', childSource.indexOf('var x'))
    const def = index.findDefinition(childUri, idx)
    expect(def?.uri).toBe(parentUri)
    expect(def?.target.symbol.name).toBe('Item')
  })

  it('remove drops document and module uri mapping', () => {
    const uri = 'file:///rm.asfl'
    index.upsert(uri, 'module SYSTEM_X;\nend_module')
    expect(index.get(uri)).toBeDefined()
    index.remove(uri)
    expect(index.get(uri)).toBeUndefined()
    expect(index.uriForModule('X')).toBeUndefined()
  })
})
