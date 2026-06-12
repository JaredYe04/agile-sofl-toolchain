import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from '@agile-sofl/parser'
import {
  buildVisualModelTolerant,
  patchExt,
  patchProcessSignature,
  patchFunctionSignature,
  patchAlias,
  addModule,
  removeModule,
  renameModule
} from '../src/index.js'

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), '../../parser/tests/fixtures/grammar')

function loadFixture(rel: string): string {
  return readFileSync(join(fixtureRoot, rel), 'utf8')
}

describe('Phase 5 visual DTO', () => {
  it('exposes ext, alias, and signature on processes', () => {
    const source = loadFixture('processes/ext-alias.asfl')
    const model = buildVisualModelTolerant(source)
    const proc = model.modules[0]?.processes.find((p) => p.name === 'Worker')
    expect(proc?.ext).toEqual([
      { access: 'rd', name: 'total', type: 'nat' },
      { access: 'wr', name: 'subtotal', type: 'int' }
    ])
    expect(proc?.signature).toBe('()')
    const alias = model.modules[0]?.processes.find((p) => p.name === 'Dup')
    expect(alias?.isAlias).toBe(true)
    expect(alias?.aliasTarget).toBe('Sub.P')
  })
})

describe('patchExt', () => {
  it('replaces ext block', () => {
    const source = loadFixture('processes/ext-alias.asfl')
    const next = patchExt(source, 'Proc', 'Worker', [
      { access: 'rd', name: 'count', type: 'nat' }
    ])
    expect(next).toContain('rd count: nat')
    expect(next).not.toContain('rd total')
  })
})

describe('patchProcessSignature', () => {
  it('updates process header params', () => {
    const source = loadFixture('processes/ext-alias.asfl')
    const next = patchProcessSignature(source, 'Proc', 'Worker', '(x: nat) ok: nat')
    expect(next).toContain('process Worker (x: nat) ok: nat')
  })
})

describe('patchAlias', () => {
  it('updates alias target', () => {
    const source = loadFixture('processes/ext-alias.asfl')
    const next = patchAlias(source, 'Proc', 'Dup', 'Sub.P')
    expect(next).toContain('process Dup equal Sub.P')
  })
})

describe('modulePatch', () => {
  it('adds, renames, and removes modules', () => {
    const source = 'module A;\nend_module'
    const added = addModule(source, 'B', { parentName: 'A' })
    expect(added).toContain('module B / A;')
    const renamed = renameModule(added, 'B', 'Beta')
    expect(renamed).toContain('module Beta / A;')
    const removed = removeModule(renamed, 'Beta')
    expect(removed).not.toContain('module Beta')
    expect(removed).toContain('module A;')
  })
})

describe('patchFunctionSignature', () => {
  it('updates function header', () => {
    const source = `module M;\nfunction fee(x: nat): nat\n== x\nend_function\nend_module`
    const next = patchFunctionSignature(source, 'M', 'fee', '(amount: nat): bool')
    expect(next).toContain('function fee(amount: nat): bool')
    const { ast } = parse(next)
    const fn = ast?.modules[0]?.functions[0]
    expect(fn?.params[0]?.names[0]).toBe('amount')
  })
})
