import { describe, expect, it } from 'vitest'
import { defaultDockLayout, dockPanel, isValidDockLayout, removePanel } from '../src/renderer/lib/dockLayout'

describe('dockLayout', () => {
  it('default layout contains all panels', () => {
    expect(isValidDockLayout(defaultDockLayout())).toBe(true)
  })

  it('docks informal to the right of hybrid', () => {
    const root = defaultDockLayout()
    const next = dockPanel(root, 'informal', 'hybrid', 'right')
    expect(next).not.toBeNull()
    expect(isValidDockLayout(next!)).toBe(true)
  })

  it('remove and collapse split', () => {
    const leaf = { kind: 'panel' as const, panel: 'hybrid' as const }
    const split = {
      kind: 'split' as const,
      direction: 'horizontal' as const,
      ratio: 0.5,
      first: { kind: 'panel' as const, panel: 'informal' as const },
      second: leaf
    }
    const { tree } = removePanel(split, 'informal')
    expect(tree).toEqual(leaf)
  })
})
