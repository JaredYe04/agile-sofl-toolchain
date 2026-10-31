import { describe, expect, it } from 'vitest'
import { parse } from '@agile-sofl/parser'
import {
  detectOpenGuiModules,
  guiStubBlocksParse,
  repairGuiModuleStub
} from '../src/guiModuleStubRepair.js'

const PREFIX = `module SYSTEM_Shop;
end_module;
module Catalog / Shop;
process List () ok: bool
  pre true
  post ok = true
end_process
end_module;
`

describe('repairGuiModuleStub', () => {
  it('closes a one-line GUI placeholder without end_module', () => {
    const broken = `${PREFIX}module GUI_App / Shop;`
    expect(detectOpenGuiModules(broken)).toEqual(['GUI_App'])
    expect(guiStubBlocksParse(broken)).toBe(true)
    const { text, notes } = repairGuiModuleStub(broken)
    expect(notes.some((n) => /end_module/i.test(n))).toBe(true)
    expect(text).toMatch(/module GUI_App[\s\S]*end_module/)
    const { ast, diagnostics } = parse(text)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    expect(ast?.type).toBe('program')
    if (ast?.type === 'program') {
      expect(ast.modules.some((m) => m.name === 'GUI_App')).toBe(true)
    }
  })

  it('rewrites SYSTEM_ parent and invalid separators', () => {
    const broken = `${PREFIX}module GUI_CourseHubApp / SYSTEM_CourseHub;`
    const { text } = repairGuiModuleStub(broken)
    expect(text).toContain('module GUI_CourseHubApp / CourseHub;')
    expect(text).toContain('end_module')
    const { diagnostics } = parse(text)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })

  it('fixes : ~ and % placeholder variants', () => {
    for (const header of [
      'module GUI_x : Shop;',
      'module GUI_x ~ Shop;',
      'module GUI_x / Shop%;'
    ]) {
      const { text } = repairGuiModuleStub(`${PREFIX}${header}`)
      const { diagnostics } = parse(text)
      expect(diagnostics.filter((d) => d.severity === 'error'), header).toHaveLength(0)
    }
  })
})
