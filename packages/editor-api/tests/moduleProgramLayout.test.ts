import { describe, expect, it } from 'vitest'
import { parse } from '@agile-sofl/parser'
import {
  hybridSuffixAfterProgramDot,
  integrateOrphanModulesAfterProgramDot,
  insertHybridTextBeforeProgramDot,
  orphanModuleHeaders
} from '../src/moduleProgramLayout.js'
import { applyHybridPatch, formatHybridInventory } from '../src/index.js'
import { hybridLeftoverMessage } from '../src/moduleSourceRange.js'

const MAIN = `module SYSTEM_Shop;
end_module;
module Catalog / Shop;
process List () ok: bool
  pre true
  post ok = true
end_process
end_module.`

const GUI_STUB = `module GUI_App / Shop;
end_module`

describe('moduleProgramLayout', () => {
  it('detects GUI stub appended after the program dot', () => {
    const broken = `${MAIN}\n${GUI_STUB}`
    expect(hybridSuffixAfterProgramDot(broken)).toMatch(/program dot/)
    expect(hybridLeftoverMessage(broken)).toMatch(/program dot/)
    expect(orphanModuleHeaders(broken)).toEqual(['GUI_App'])
  })

  it('integrates orphan modules so the full program parses', () => {
    const broken = `${MAIN}\n${GUI_STUB}`
    const { text, notes } = integrateOrphanModulesAfterProgramDot(broken)
    expect(notes.length).toBe(1)
    expect(text.indexOf('module GUI_App')).toBeLessThan(text.lastIndexOf('.'))
    const { ast, diagnostics } = parse(text)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    expect(ast?.type).toBe('program')
    if (ast?.type === 'program') {
      expect(ast.modules.map((m) => m.name)).toEqual(['Shop', 'Catalog', 'GUI_App'])
    }
    expect(orphanModuleHeaders(text)).toEqual([])
    expect(formatHybridInventory(text)).toContain('mod:GUI_App')
  })

  it('insertHybridTextBeforeProgramDot matches addModule dot semantics', () => {
    const next = insertHybridTextBeforeProgramDot(MAIN, GUI_STUB)
    expect(next.indexOf('module GUI_App')).toBeLessThan(next.lastIndexOf('.'))
    const { ast } = parse(next)
    expect(ast?.type).toBe('program')
    if (ast?.type === 'program') {
      expect(ast.modules.some((m) => m.name === 'GUI_App')).toBe(true)
    }
  })

  it('applyHybridPatch integrates a trailing GUI stub left by source append', () => {
    const appended = `${MAIN}\n${GUI_STUB}`
    const { content, lintWarnings } = applyHybridPatch(appended, { operations: [] })
    expect(lintWarnings?.some((w) => /program dot/i.test(w))).toBe(true)
    const { ast } = parse(content)
    expect(ast?.type).toBe('program')
    if (ast?.type === 'program') {
      expect(ast.modules.some((m) => m.name === 'GUI_App')).toBe(true)
    }
  })
})
