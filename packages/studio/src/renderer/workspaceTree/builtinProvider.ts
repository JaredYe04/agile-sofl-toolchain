import { useGitStatus } from '../composables/useGitStatus'
import type { WorkspaceTreeMenuItem, WorkspaceTreeMenuProvider } from './types'

export const builtinWorkspaceTreeMenuProvider: WorkspaceTreeMenuProvider = {
  id: 'studio.builtin.workspaceTree',
  priority: 100,
  items(ctx): WorkspaceTreeMenuItem[] {
    if (ctx.kind === 'blank') {
      return [
        { id: 'newProject', labelKey: 'workspace.treeMenu.newProject' },
        { id: 'openProject', labelKey: 'workspace.treeMenu.openProject' },
        { id: 'collapseAll', labelKey: 'workspace.treeMenu.collapseAll', separator: true }
      ]
    }
    if (ctx.kind === 'project') {
      const { isRepo } = useGitStatus()
      const items: WorkspaceTreeMenuItem[] = [
        { id: 'copyName', labelKey: 'workspace.treeMenu.copyName' },
        { id: 'copyPath', labelKey: 'workspace.treeMenu.copyPath' },
        { id: 'revealInFolder', labelKey: 'workspace.treeMenu.revealInFolder' },
        { id: 'refresh', labelKey: 'workspace.treeMenu.refresh' }
      ]
      if (!isRepo(ctx.project.rootPath)) {
        items.push({ id: 'initGit', labelKey: 'workspace.treeMenu.initGit' })
      }
      items.push(
        { id: 'renameProject', labelKey: 'workspace.treeMenu.renameProject', separator: true },
        { id: 'removeFromList', labelKey: 'workspace.treeMenu.removeFromList' }
      )
      return items
    }
    return [
      { id: 'copyName', labelKey: 'workspace.treeMenu.copyName' },
      { id: 'revealInCode', labelKey: 'workspace.treeMenu.revealInCode' },
      { id: 'renameModule', labelKey: 'workspace.treeMenu.renameModule', separator: true },
      { id: 'deleteModule', labelKey: 'workspace.treeMenu.deleteModule' },
      { id: 'addSubmodule', labelKey: 'workspace.treeMenu.addSubmodule', disabled: true }
    ]
  }
}
