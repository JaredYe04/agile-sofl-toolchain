import { describe, it, expect } from 'vitest'
import { check, moduleArtifacts, moduleToXml } from '../../src/index'

const src = `module SYSTEM_A;\ntype Money = nat0;\nprocess P (x: Money) r: bool\nFSF :\n x > 0 && r = true || others && r = false\nend_process\nend_module;\nmodule B / SYSTEM_A;\nvar fee: Money;\nend_module.`

describe('module XML (grammar G:36-38 dual save)', () => {
  it('produces one text + XML artifact per module', () => {
    const { ast } = check(src)
    const arts = moduleArtifacts(ast!, src)
    expect(arts.map((a) => a.moduleName)).toEqual(['SYSTEM_A', 'B'])
    expect(arts[0]!.text).toContain('process P')
    expect(arts[1]!.text.startsWith('module B / SYSTEM_A;')).toBe(true)
  })

  it('XML is well-formed-ish, carries source + AST and escapes text', () => {
    const { ast } = check(src)
    const xml = moduleToXml(ast!.modules[0]!, src)
    expect(xml.startsWith('<?xml version="1.0"')).toBe(true)
    expect(xml).toContain('<asfl-module xmlns="urn:agile-sofl:module:1" schemaVersion="1" name="SYSTEM_A" system="true">')
    expect(xml).toContain('<![CDATA[module SYSTEM_A;')
    expect(xml).toContain('<fsf_spec')
    expect(xml).toContain('kind="gt"')
    // tags balance (crude well-formedness check outside CDATA)
    const body = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '').replace(/<\?xml[^>]*\?>/, '')
    const opens = (body.match(/<[A-Za-z_][^>]*[^/]>|<[A-Za-z_]>/g) ?? []).length
    const closes = (body.match(/<\/[^>]+>/g) ?? []).length
    expect(opens).toBe(closes)
    expect(body).not.toMatch(/&(?!amp;|lt;|gt;|quot;)/)
  })
})
