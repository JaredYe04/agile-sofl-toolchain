import { describe, it, expect, beforeEach } from 'vitest'
import {
  persistWorkspace,
  restoreWorkspace,
  clearWorkspaceSession
} from '../src/renderer/stores/workspaceSession'
import { createDocumentTab, createHomeTab, HOME_TAB_ID } from '../src/renderer/stores/tabUtils'

describe('workspaceSession', () => {
  beforeEach(() => {
    sessionStorage.clear()
    clearWorkspaceSession()
  })

  it('round-trips document tabs and active id', () => {
    const home = createHomeTab()
    const doc1 = createDocumentTab({ title: 'A.asfl', content: 'module A;\nend_module' })
    const doc2 = createDocumentTab({ title: 'B.asfl', content: 'module B;\nend_module' })
    persistWorkspace(doc2.id, [home, doc1, doc2])

    const restored = restoreWorkspace()
    expect(restored).not.toBeNull()
    expect(restored!.activeTabId).toBe(doc2.id)
    expect(restored!.tabs.filter((t) => t.kind === 'document')).toHaveLength(2)
    expect(restored!.tabs.find((t) => t.id === doc1.id)?.content).toContain('module A')
  })

  it('returns null when session empty', () => {
    expect(restoreWorkspace()).toBeNull()
  })

  it('clears session when no document tabs', () => {
    persistWorkspace(HOME_TAB_ID, [createHomeTab()])
    expect(sessionStorage.getItem('studio-workspace-session')).toBeNull()
  })
})
