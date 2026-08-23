import { describe, expect, it } from 'vitest'
import { layoutHierarchyForest, elbowPath } from '../src/renderer/lib/hierarchyTreeLayout'

describe('hierarchyTreeLayout', () => {
  const mods = [
    { name: 'Lib', displayName: 'SYSTEM_Library', isSystem: true },
    { name: 'Circulation', displayName: 'Circulation', parentName: 'Library' },
    { name: 'Reports', displayName: 'Reports', parentName: 'Library' },
    { name: 'GUI_App', displayName: 'GUI_App', isGui: true, parentName: 'Library' }
  ]

  it('packs a vertical tree into a narrow viewport', () => {
    const layout = layoutHierarchyForest(mods, 160)
    expect(layout.nodes.map((n) => n.name)).toEqual(
      expect.arrayContaining(['Lib', 'Circulation', 'Reports', 'GUI_App'])
    )
    expect(layout.width).toBeLessThanOrEqual(180)
    const root = layout.nodes.find((n) => n.name === 'Lib')!
    const child = layout.nodes.find((n) => n.name === 'Circulation')!
    expect(child.y).toBeGreaterThan(root.y)
    expect(layout.links.length).toBe(3)
  })

  it('builds orthogonal connectors from parent to child', () => {
    const layout = layoutHierarchyForest(mods, 200)
    const link = layout.links[0]!
    const d = elbowPath(link.from, link.to)
    expect(d.startsWith('M ')).toBe(true)
    expect(d).toContain(' L ')
  })
})
