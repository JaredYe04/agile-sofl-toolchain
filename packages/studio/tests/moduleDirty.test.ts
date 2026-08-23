import { describe, expect, it } from 'vitest'
import { dirtyModuleNames } from '../src/renderer/lib/moduleDirty'

describe('dirtyModuleNames', () => {
  it('marks only changed module slices', () => {
    const modules = [
      { name: 'A', filePath: '/p/h.asfl' },
      { name: 'B', filePath: '/p/h.asfl' }
    ]
    const saved = { '/p/h.asfl': { A: '1', B: '2' } }
    const current = { '/p/h.asfl': { A: '1', B: '3' } }
    expect(dirtyModuleNames(modules, saved, current)).toEqual(['B'])
  })
})
