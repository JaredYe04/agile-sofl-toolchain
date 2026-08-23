import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

describe('project templates manifest', () => {
  it('lists project templates with existing source files', () => {
    const studioRoot = join(__dirname, '..')
    const manifest = JSON.parse(
      readFileSync(join(studioRoot, 'assets', 'templates', 'project-manifest.json'), 'utf-8')
    ) as {
      templates: Array<{
        id: string
        hybrid?: string[]
        informal?: string
        gui?: string
        guiHybrid?: string
        useEmptyProject?: boolean
      }>
    }

    expect(manifest.templates.length).toBeGreaterThanOrEqual(5)
    expect(manifest.templates.some((t) => t.id === 'library')).toBe(true)
    expect(manifest.templates.some((t) => t.id === 'blank')).toBe(true)

    for (const entry of manifest.templates) {
      if (entry.useEmptyProject) continue
      for (const file of entry.hybrid ?? []) {
        const local = join(studioRoot, 'public', 'templates', file)
        const example = join(studioRoot, '..', '..', 'examples', file)
        const templates = join(studioRoot, 'templates', file)
        expect(existsSync(local) || existsSync(example) || existsSync(templates)).toBe(true)
      }
      if (entry.informal) {
        const local = join(studioRoot, 'public', 'templates', entry.informal)
        const assets = join(studioRoot, 'assets', 'templates', entry.informal)
        expect(existsSync(local) || existsSync(assets)).toBe(true)
      }
      if (entry.gui) {
        const local = join(studioRoot, 'public', 'templates', entry.gui)
        const assets = join(studioRoot, 'assets', 'templates', entry.gui)
        const example = join(studioRoot, '..', '..', 'examples', entry.gui)
        expect(existsSync(local) || existsSync(assets) || existsSync(example)).toBe(true)
      }
      if (entry.guiHybrid) {
        const assets = join(studioRoot, 'assets', 'templates', entry.guiHybrid)
        const templates = join(studioRoot, 'templates', entry.guiHybrid)
        expect(existsSync(assets) || existsSync(templates)).toBe(true)
      }
    }
  })
})
