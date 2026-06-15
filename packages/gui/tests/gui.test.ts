import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { parseGuiSpec } from '../src/parse.js'
import { validateGuiSpec } from '../src/validate.js'
import { buildGuiModel } from '../src/buildGuiModel.js'
import {
  patchGui,
  patchFieldById,
  extractGuiFromAspec,
  embedGuiInAspec,
  mergeGuiSources,
  formatGui
} from '../src/patch.js'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

describe('parseGuiSpec', () => {
  it('parses minimal fixture', () => {
    const source = readFileSync(join(fixtures, 'minimal.guispec'), 'utf8')
    const { document, diagnostics } = parseGuiSpec(source)
    expect(diagnostics).toHaveLength(0)
    expect(document?.meta.title).toContain('Minimal')
    expect(document?.gui.screens[0]?.name).toBe('HomePage')
  })
})

describe('validateGuiSpec', () => {
  it('warns on unknown flow screen', () => {
    const source = readFileSync(join(fixtures, 'minimal.guispec'), 'utf8')
    const { document } = parseGuiSpec(source)
    document!.gui.flows = [{ from: 'scr-home', to: 'scr-missing' }]
    const diags = validateGuiSpec(document!)
    expect(diags.some((d) => d.code === 'GUI_STYLE_003')).toBe(true)
  })
})

describe('patchGui', () => {
  it('updates screen title by id', () => {
    const source = readFileSync(join(fixtures, 'minimal.guispec'), 'utf8')
    const next = patchFieldById(source, 'screen.scr-home.title', 'Welcome')
    expect(buildGuiModel(next).screens[0]?.title).toBe('Welcome')
  })

  it('adds and removes screen', () => {
    const source = readFileSync(join(fixtures, 'minimal.guispec'), 'utf8')
    const withScreen = patchGui(source, {
      action: 'add-screen',
      screen: { id: 'scr-x', name: 'Extra', widgets: [] }
    })
    expect(buildGuiModel(withScreen).screens).toHaveLength(2)
    const removed = patchGui(withScreen, { action: 'remove-screen', screenId: 'scr-x' })
    expect(buildGuiModel(removed).screens).toHaveLength(1)
  })

  it('adds widget to screen', () => {
    const source = readFileSync(join(fixtures, 'minimal.guispec'), 'utf8')
    const next = patchGui(source, {
      action: 'add-widget',
      screenId: 'scr-home',
      widget: { id: 'w-btn', kind: 'button', label: 'Go' }
    })
    expect(buildGuiModel(next).screens[0]?.widgetCount).toBe(2)
  })
})

describe('extract and merge', () => {
  it('extracts gui from aspec yaml', () => {
    const aspec = readFileSync(join(dirname(fixtures), '..', '..', 'aspec', 'tests', 'fixtures', 'minimal.aspec'), 'utf8')
    const withGui = embedGuiInAspec(aspec, {
      app: { name: 'LibUI' },
      screens: [{ id: 's1', name: 'Main', widgets: [] }]
    })
    const gui = extractGuiFromAspec(withGui)
    expect(gui?.app.name).toBe('LibUI')
  })

  it('merges external over embedded on id clash', () => {
    const embedded = {
      app: { name: 'A' },
      screens: [{ id: 's1', name: 'Embedded', widgets: [] }]
    }
    const external = {
      app: { name: 'B' },
      screens: [{ id: 's1', name: 'External', widgets: [] }]
    }
    const merged = mergeGuiSources(embedded, external)
    expect(merged?.screens[0]?.name).toBe('External')
    expect(merged?.app.name).toBe('B')
  })
})

describe('formatGui', () => {
  it('re-serializes document', () => {
    const source = readFileSync(join(fixtures, 'minimal.guispec'), 'utf8')
    const formatted = formatGui(source.replace(/\n/g, '\n\n'))
    expect(buildGuiModel(formatted).app.name).toBe('MinimalApp')
  })
})

describe('buildGuiModel cross-ref', () => {
  it('warns when triggersProcess unknown', () => {
    const source = readFileSync(join(fixtures, 'minimal.guispec'), 'utf8')
    const next = patchFieldById(source, 'screen.scr-home.triggersProcess', 'proc-unknown')
    const model = buildGuiModel(next, {
      informalModules: [{ id: 'm1', processes: [{ id: 'proc-borrow', name: 'Borrow' }] }]
    })
    expect(model.diagnostics.some((d) => d.code === 'GUI_STYLE_002')).toBe(true)
  })
})

describe('coverageGui', () => {
  it('builds trace links for screens', async () => {
    const { buildGuiTraceLinks } = await import('../src/trace/coverageGui.js')
    const source = readFileSync(join(fixtures, 'minimal.guispec'), 'utf8')
    const model = buildGuiModel(source)
    const links = buildGuiTraceLinks(model)
    expect(links.some((l) => l.kind === 'gui-screen')).toBe(true)
  })
})
