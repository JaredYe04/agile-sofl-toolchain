import { describe, it, expect } from 'vitest'
import { check as checkSpec, parseGuiBlock } from '@agile-sofl/parser'
import {
  addAspecConst,
  patchFieldById,
  updateTraceContentHash,
  buildFunctionFsf,
  shouldRenderFunctionFsf,
  parseAspec,
  refineToAsfl
} from '../src/index.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

describe('addAspecConst', () => {
  it('adds and patches constants', () => {
    const source = readFileSync(join(fixtures, 'minimal.aspec'), 'utf8')
    const withConst = addAspecConst(source, 'mod-library', {
      id: 'const-max',
      name: 'max_books',
      valueHint: '100'
    })
    expect(withConst).toContain('max_books')
    const patched = patchFieldById(withConst, 'const.const-max.valueHint', '200')
    expect(patched).toContain('200')
  })
})

describe('function FSF refine helpers', () => {
  it('renders semi-formal function FSF when expected', () => {
    expect(
      shouldRenderFunctionFsf({
        bodyHint: 'member is registered',
        refinementHints: { expectedFsfLevel: 'semi-formal' }
      })
    ).toBe(true)
    const fsf = buildFunctionFsf({
      bodyHint: 'member is registered',
      refinementHints: { expectedFsfLevel: 'semi-formal' }
    })
    expect(fsf).toContain('informal')
  })
})

describe('updateTraceContentHash', () => {
  it('updates hash without removing links', () => {
    const trace = JSON.stringify({
      traceVersion: '1.0',
      contentHash: 'sha256:old',
      links: [{ aspecId: 'p1', kind: 'process', status: 'covered' }]
    })
    const next = updateTraceContentHash(trace, 'aspecVersion: "1.0"\nmeta:\n  id: x\n')
    const parsed = JSON.parse(next)
    expect(parsed.links).toHaveLength(1)
    expect(parsed.contentHash).not.toBe('sha256:old')
  })
})

describe('parseGuiBlock', () => {
  it('parses gui block from module slice', () => {
    const source = `module SYSTEM_M;
gui G;
screen S;
    label w "Hi";
end_screen;
end_gui;
process P ()
    FSF :
    others && true
end_process
end_module`
    const { gui, diagnostics } = parseGuiBlock(source, 0, source.length)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    expect(gui?.name).toBe('G')
    expect(gui?.screens[0]?.widgets[0]?.text).toBe('Hi')
  })
})

describe('emitGuiBlock refine', () => {
  it('embeds gui block from guispec source', () => {
    const aspec = readFileSync(join(fixtures, 'minimal.aspec'), 'utf8')
    const guiSource = `guispecVersion: "1.0"
meta:
  id: gui-lib
  title: Library GUI
gui:
  app:
    name: LibGui
  screens:
    - id: s1
      name: Home
      widgets:
        - id: welcome
          kind: label
          label: Welcome
        - id: go
          kind: button
          label: Go
          action: P
`
    const { document } = parseAspec(aspec)
    expect(document).not.toBeNull()
    const result = refineToAsfl(document!, aspec, { emitGuiBlock: true, guiSource })
    expect(result.asflText).toContain('gui LibGui;')
    expect(result.asflText).toContain('screen Home;')
    expect(result.asflText).toContain('label welcome "Welcome";')
    const checkResult = checkSpec(result.asflText)
    expect(checkResult.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })
})

describe('check with gui block', () => {
  it('accepts module with gui block', () => {
    const source = `module SYSTEM_T;
type
    N = nat;
inv
    true;
gui AppGui;
screen Home;
    button go "Go" triggers P;
end_screen;
end_gui;
process P () ok: nat
    FSF :
    others && true
end_process
end_module`
    const result = checkSpec(source)
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    expect(result.ast?.modules[0]?.gui?.name).toBe('AppGui')
  })
})
