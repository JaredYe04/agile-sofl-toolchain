import { describe, it, expect } from 'vitest'
import { mkdtempSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeModuleArtifacts, moduleArtifactDir } from '../src/main/services/dualSave'

const spec = `module SYSTEM_Shop;\ntype Money = nat0;\nend_module;\nmodule Cart / SYSTEM_Shop;\nvar total: Money;\nend_module.`

describe('dual save: text + XML per module on save', () => {
  it('writes <Module>.asfl and <Module>.xml for every module', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dual-'))
    const file = join(dir, 'shop.asfl')
    const r = writeModuleArtifacts(file, spec)
    const out = moduleArtifactDir(file)
    expect(r.skipped).toBeUndefined()
    expect(readdirSync(out).sort()).toEqual(['Cart.asfl', 'Cart.xml', 'SYSTEM_Shop.asfl', 'SYSTEM_Shop.xml'])
    expect(readFileSync(join(out, 'Cart.asfl'), 'utf-8')).toContain('var total: Money;')
    expect(readFileSync(join(out, 'Cart.xml'), 'utf-8')).toContain('name="Cart"')
  })

  it('removes artifacts of deleted modules and skips non-asfl / unparsable files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dual-'))
    const file = join(dir, 'shop.asfl')
    writeModuleArtifacts(file, spec)
    writeModuleArtifacts(file, `module SYSTEM_Shop;\nend_module.`)
    expect(readdirSync(moduleArtifactDir(file)).sort()).toEqual(['SYSTEM_Shop.asfl', 'SYSTEM_Shop.xml'])
    expect(writeModuleArtifacts(join(dir, 'x.aspec'), '# hi').skipped).toBeTruthy()
    expect(existsSync(moduleArtifactDir(join(dir, 'x.aspec')))).toBe(false)
  })
})
