import { describe, expect, it } from 'vitest'
import {
  assignPanelToSlot,
  buildDockLayout,
  defaultDockLayout,
  reorderSlotPanels
} from '../src/renderer/lib/workspaceLayout'
import type { DockNode } from '../src/shared/dockLayout'

function collectPanelsFromLayout(root: DockNode): Set<string> {
  const out = new Set<string>()
  const walk = (node: DockNode): void => {
    if (node.kind === 'panel') {
      out.add(node.panel)
      return
    }
    walk(node.first)
    walk(node.second)
  }
  walk(root)
  return out
}

describe('workspaceLayout', () => {
  it('default layout maps slots to informal, agent, hybrid', () => {
    const root = defaultDockLayout()
    expect(collectPanelsFromLayout(root)).toEqual(new Set(['informal', 'agent', 'hybrid']))
  })

  it('three-column preset places each slot in its own column', () => {
    const root = buildDockLayout('threeColumn', ['informal', 'agent', 'hybrid'])
    expect(collectPanelsFromLayout(root).size).toBe(3)
  })

  it('assignPanelToSlot swaps duplicates', () => {
    const next = assignPanelToSlot(['informal', 'agent', 'hybrid'], 0, 'hybrid')
    expect(next).toEqual(['hybrid', 'agent', 'informal'])
  })

  it('reorderSlotPanels permutes assignments', () => {
    const next = reorderSlotPanels(['informal', 'agent', 'hybrid'], 0, 2)
    expect(next).toEqual(['agent', 'hybrid', 'informal'])
  })
})
