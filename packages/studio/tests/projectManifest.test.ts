import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, afterEach } from 'vitest'
import { createProjectTemplate, inferManifest, readManifest } from '../src/main/services/projectManifest'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('projectManifest', () => {
  it('creates a folder project with spec files and manifest', () => {
    const root = mkdtempSync(join(tmpdir(), 'asfl-proj-'))
    dirs.push(root)
    const nested = join(root, 'DemoSys')
    const manifest = createProjectTemplate(nested, 'DemoSys')
    expect(manifest.name).toBe('DemoSys')
    expect(manifest.guiModule).toBe('GUI_App')
    expect(readManifest(nested)?.informal).toBe('informal.aspec')
    expect(readFileSync(join(nested, 'informal.aspec'), 'utf-8')).toContain('# Functions')
    expect(readFileSync(join(nested, 'hybrid.asfl'), 'utf-8')).toContain('module GUI_App')
    expect(readFileSync(join(nested, 'gui.html'), 'utf-8')).toContain('data-screen')
  })

  it('hybrid template parses as a program with a GUI module', async () => {
    const root = mkdtempSync(join(tmpdir(), 'asfl-parse-'))
    dirs.push(root)
    const nested = join(root, 'DemoSys')
    createProjectTemplate(nested, 'DemoSys')
    const { parse } = await import('@agile-sofl/parser')
    const source = readFileSync(join(nested, 'hybrid.asfl'), 'utf-8')
    const result = parse(source)
    expect(result.ast?.type).toBe('program')
    expect(result.ast?.modules.map((m) => m.name)).toEqual(expect.arrayContaining(['DemoSys', 'GUI_App']))
    expect(result.ast?.modules.find((m) => m.name === 'GUI_App')?.gui).toBeTruthy()
  })

  it('infers manifest from existing spec files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'asfl-infer-'))
    dirs.push(root)
    const nested = join(root, 'Lib')
    createProjectTemplate(nested, 'Lib')
    const inferred = await inferManifest(nested)
    expect(inferred.informal).toBe('informal.aspec')
    expect(inferred.hybrid).toContain('hybrid.asfl')
    expect(inferred.gui).toBe('gui.html')
  })
})
