import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWorkspaceStore } from '../src/renderer/stores/workspace'
import { useDocumentStore } from '../src/renderer/stores/document'
import { modulesFromSource } from '../src/shared/modulesFromSource'
import type { IndexedProject, WorkspaceScanPayload } from '../src/shared/projectTypes'

const tradingRoot = 'D:/asfl/test'
const foodRoot = 'D:/asfl/food'

const trading: IndexedProject = {
  id: 'p-trading',
  name: 'test',
  rootPath: tradingRoot,
  lastOpenedAt: 1,
  createdAt: 1
}

const food: IndexedProject = {
  id: 'p-food',
  name: '模拟外卖系统',
  rootPath: foodRoot,
  lastOpenedAt: 2,
  createdAt: 2
}

const tradingSource = `module Auth;
end_module
module Trading;
end_module
`

const foodSource = `module MockDelivery_System;
end_module
module User_Module;
end_module
`

function scanFor(root: string, asflPath: string, source: string): WorkspaceScanPayload {
  return {
    root,
    manifest: { version: '1.0', name: root, informal: 'informal.aspec', hybrid: ['hybrid.asfl'] },
    files: [{ path: asflPath, kind: 'asfl' }],
    modules: modulesFromSource(source, asflPath)
  }
}

describe('project isolation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.assign(globalThis, { window: globalThis })
    window.studio = {
      modulesFromSource: async (payload: { source: string; filePath: string; guiModule?: string }) =>
        modulesFromSource(payload.source, payload.filePath, payload.guiModule)
    } as typeof window.studio
  })

  it('does not merge another project\'s open hybrid tab into the active module list', async () => {
    const doc = useDocumentStore()
    const workspace = useWorkspaceStore()
    doc.openFromFile(`${tradingRoot}/hybrid.asfl`, tradingSource, 'hybrid.asfl')
    doc.openFromFile(`${foodRoot}/hybrid.asfl`, foodSource, 'hybrid.asfl')
    workspace.projects = [trading, food]
    workspace.activeProjectId = food.id
    workspace.scan = scanFor(foodRoot, `${foodRoot}/hybrid.asfl`, foodSource)
    workspace.selectedModuleName = 'MockDelivery_System'

    await workspace.resyncModulesFromOpenTabs()

    expect(workspace.modules.map((m) => m.name)).toEqual(['MockDelivery_System', 'User_Module'])
    expect(workspace.modulesFor(trading.id)).toEqual([])
    expect(workspace.hybridTab?.content).toContain('MockDelivery_System')
    expect(workspace.hybridTab?.content).not.toContain('module Trading')
  })

  it('closes foreign tabs when activating another project', async () => {
    const doc = useDocumentStore()
    doc.openFromFile(`${tradingRoot}/hybrid.asfl`, tradingSource, 'hybrid.asfl')
    doc.openFromFile(`${foodRoot}/hybrid.asfl`, foodSource, 'hybrid.asfl')
    doc.closeTabsOutsideRoot(foodRoot)
    expect(doc.documentTabs).toHaveLength(1)
    expect(doc.documentTabs[0]?.filePath).toBe(`${foodRoot}/hybrid.asfl`)
  })
})
