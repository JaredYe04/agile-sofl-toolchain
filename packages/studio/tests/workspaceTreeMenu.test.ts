import { describe, expect, it } from 'vitest'
import { builtinWorkspaceTreeMenuProvider } from '../src/renderer/workspaceTree/builtinProvider'
import { buildWorkspaceTreeMenu, registerWorkspaceTreeMenuProvider } from '../src/renderer/workspaceTree/registry'
import type { IndexedProject } from '../src/preload/index'

const project: IndexedProject = {
  id: 'p1',
  name: 'Lib',
  rootPath: '/tmp/Lib',
  lastOpenedAt: 1,
  createdAt: 1
}

describe('workspace tree menu', () => {
  it('lists blank, project, and module actions from the builtin provider', () => {
    registerWorkspaceTreeMenuProvider(builtinWorkspaceTreeMenuProvider)
    const blank = buildWorkspaceTreeMenu({ kind: 'blank' }).map((i) => i.id)
    expect(blank).toEqual(['newProject', 'openProject', 'collapseAll'])
    const proj = buildWorkspaceTreeMenu({ kind: 'project', project }).map((i) => i.id)
    expect(proj).toContain('copyPath')
    expect(proj).toContain('removeFromList')
    expect(proj).toContain('initGit')
    const mod = builtinWorkspaceTreeMenuProvider.items({
      kind: 'module',
      project,
      module: {
        name: 'GUI_App',
        displayName: 'GUI_App',
        filePath: '/tmp/Lib/hybrid.asfl',
        isSystem: false,
        isGui: true,
        spanStart: 0,
        spanEnd: 10
      }
    })
    expect(mod.some((i) => i.id === 'deleteModule')).toBe(true)
    expect(mod.find((i) => i.id === 'addSubmodule')?.disabled).toBe(true)
  })
})
