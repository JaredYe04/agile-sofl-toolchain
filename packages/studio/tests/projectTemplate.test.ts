import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, afterEach } from 'vitest'
import { createProjectFromTemplate, loadProjectTemplateManifest } from '../src/main/services/projectTemplate'
import { readManifest } from '../src/main/services/projectManifest'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('projectTemplate', () => {
  const templatesDir = join(__dirname, '../public/templates')

  it('loads project template manifest', () => {
    const entries = loadProjectTemplateManifest(templatesDir)
    expect(entries.some((e) => e.id === 'library')).toBe(true)
    expect(entries.some((e) => e.id === 'blank')).toBe(true)
  })

  it('materializes library project with standard folder layout', () => {
    const root = mkdtempSync(join(tmpdir(), 'asfl-tmpl-'))
    dirs.push(root)
    const nested = join(root, 'LibraryDemo')
    const manifest = createProjectFromTemplate(nested, 'Library Demo', 'library', templatesDir)
    expect(manifest.informal).toBe('informal.aspec')
    expect(manifest.hybrid).toEqual(['hybrid.asfl'])
    expect(manifest.gui).toBe('gui.guispec')
    expect(readManifest(nested)?.name).toBe('Library Demo')
    const informal = readFileSync(join(nested, 'informal.aspec'), 'utf-8')
    expect(informal).toContain('hybridTarget: ./hybrid.asfl')
    expect(readFileSync(join(nested, 'hybrid.asfl'), 'utf-8')).toContain('module SYSTEM_Library')
    const gui = readFileSync(join(nested, 'gui.guispec'), 'utf-8')
    expect(gui).toContain('informalTarget: ./informal.aspec')
    expect(gui).toContain('targetView: view-borrow')
    const hybrid = readFileSync(join(nested, 'hybrid.asfl'), 'utf-8')
    expect(hybrid).toContain('module GUI_App / Library')
    expect(hybrid).toContain('current_view')
  })

  it('materializes example project with GUI module, screens and constraints', () => {
    const root = mkdtempSync(join(tmpdir(), 'asfl-tmpl-'))
    dirs.push(root)
    const nested = join(root, 'Shop')
    const manifest = createProjectFromTemplate(nested, 'Shop', 'ecommerce', templatesDir)
    expect(manifest.gui).toBe('gui.guispec')
    expect(manifest.guiModule).toBe('GUI_App')
    expect(readFileSync(join(nested, 'hybrid.asfl'), 'utf-8')).toContain('SYSTEM_Ecommerce')
    expect(readFileSync(join(nested, 'hybrid.asfl'), 'utf-8')).toContain('module GUI_App / Ecommerce')
    const informal = readFileSync(join(nested, 'informal.aspec'), 'utf-8')
    expect(informal).toContain('hybridTarget: ./hybrid.asfl')
    expect(informal).toContain('guiTarget: ./gui.guispec')
    expect(informal).toContain('AddToCart')
    expect(readFileSync(join(nested, 'gui.guispec'), 'utf-8')).toContain('view-checkout')
  })

  it('appended GUI module parses with the example hybrid', async () => {
    const root = mkdtempSync(join(tmpdir(), 'asfl-tmpl-'))
    dirs.push(root)
    const nested = join(root, 'LibraryDemo')
    createProjectFromTemplate(nested, 'Library Demo', 'library', templatesDir)
    const { parse } = await import('@agile-sofl/parser')
    const source = readFileSync(join(nested, 'hybrid.asfl'), 'utf-8')
    const result = parse(source)
    expect(result.ast?.modules.map((m) => m.name)).toEqual(
      expect.arrayContaining(['Library', 'GUI_App'])
    )
    expect(result.ast?.modules.find((m) => m.name === 'GUI_App')?.gui?.screens.map((s) => s.name)).toEqual(
      expect.arrayContaining(['Home', 'Borrow', 'ReturnBook'])
    )
  })
})
