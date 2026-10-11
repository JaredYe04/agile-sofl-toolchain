import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WRITE_PATHS } from '../src/shared/dasr/writePaths'

const studioRoot = join(__dirname, '..')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'out') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|vue)$/.test(name)) out.push(full)
  }
  return out
}

describe('decision gate covers the Phase 0 write-path inventory', () => {
  it('every audited path has a gate marker or a documented exception', () => {
    const ids = new Set<string>()
    for (const row of WRITE_PATHS) {
      expect(ids.has(row.id)).toBe(false)
      ids.add(row.id)
      const text = readFileSync(join(studioRoot, row.site), 'utf8')
      if (row.exception) {
        expect(row.exceptionReason && row.exceptionReason.length).toBeGreaterThan(40)
        expect(text.length).toBeGreaterThan(0)
        continue
      }
      if (row.viaApplyDocument) {
        expect(text).toContain('applyDocument(')
        expect(readFileSync(join(studioRoot, 'src/renderer/stores/history.ts'), 'utf8')).toContain('dasr-gate:direct-editor')
        continue
      }
      expect(row.marker, row.id).toBeTruthy()
      expect(text, row.id).toContain(row.marker!)
    }
    expect(ids.has('auto-write')).toBe(true)
    expect(ids.has('propose_source_edit')).toBe(true)
    expect(ids.has('propose_gui_changes')).toBe(true)
    expect(ids.has('b0-auto')).toBe(true)
    expect(ids.has('harness-auto-accept')).toBe(true)
  })

  it('new DASR sources do not call refinement-obligation counters ambiguity', () => {
    const files = walk(join(studioRoot, 'src/shared/dasr'))
    expect(files.length).toBeGreaterThan(3)
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      expect(text, file).not.toMatch(/ambiguity/i)
    }
  })
})
