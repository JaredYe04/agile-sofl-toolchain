import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

describe('templates manifest', () => {
  it('lists required templates with existing source files', () => {
    const studioRoot = join(__dirname, '..')
    const manifest = JSON.parse(
      readFileSync(join(studioRoot, 'templates', 'manifest.json'), 'utf-8')
    ) as { templates: Array<{ id: string; file: string }> }

    expect(manifest.templates.length).toBeGreaterThanOrEqual(6)
    expect(manifest.templates.some((t) => t.id === 'blank')).toBe(true)
    expect(manifest.templates.some((t) => t.id === 'ecommerce')).toBe(true)

    for (const entry of manifest.templates) {
      const local = join(studioRoot, 'templates', entry.file)
      const example = join(studioRoot, '..', '..', 'examples', entry.file)
      expect(existsSync(local) || existsSync(example)).toBe(true)
    }
  })
})
