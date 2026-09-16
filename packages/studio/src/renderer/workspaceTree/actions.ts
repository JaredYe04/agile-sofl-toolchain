import type { VisualModelContext } from '../composables/visualModelContext'
import { refreshGitFor } from '../composables/useGitStatus'
import type { WorkspaceTreeActionId, WorkspaceTreeContext } from './types'
import { useWorkspaceStore } from '../stores/workspace'
import { useModalStore } from '../stores/modal'
import { useDocumentStore } from '../stores/document'
import { filePathsEqual } from '../stores/tabUtils'

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* clipboard may be unavailable */
  }
}

export async function promptNewProject(
  t: (key: string, params?: Record<string, unknown>) => string
): Promise<void> {
  const modal = useModalStore()
  const workspace = useWorkspaceStore()
  const { index, value } = await modal.show({
    title: t('workspace.newProjectTitle'),
    message: t('workspace.newProjectMessage'),
    buttons: [t('workspace.create'), t('workspace.cancel')],
    input: true,
    inputValue: 'NewSystem',
    inputPlaceholder: t('workspace.projectName')
  })
  if (index !== 0 || !value?.trim()) return
  await workspace.createProject(value.trim())
}

export async function executeWorkspaceTreeAction(
  action: WorkspaceTreeActionId,
  ctx: WorkspaceTreeContext,
  visual: VisualModelContext | null,
  t: (key: string, params?: Record<string, unknown>) => string
): Promise<void> {
  const workspace = useWorkspaceStore()
  const modal = useModalStore()
  const doc = useDocumentStore()

  switch (action) {
    case 'newProject':
      await promptNewProject(t)
      return
    case 'openProject':
      await workspace.openProjectFolder()
      return
    case 'switchToProject':
      if (ctx.kind !== 'project') return
      await workspace.requestActivateProject(ctx.project)
      return
    case 'collapseAll':
      workspace.collapseAllProjects()
      return
    case 'copyName':
      if (ctx.kind === 'project') await copyText(ctx.project.name)
      else if (ctx.kind !== 'blank') await copyText(ctx.module.displayName)
      return
    case 'copyPath':
      if (ctx.kind === 'project') await copyText(ctx.project.rootPath)
      else if (ctx.kind !== 'blank') await copyText(ctx.module.filePath)
      return
    case 'revealInFolder':
      if (ctx.kind === 'project') await window.studio?.revealInFolder(ctx.project.rootPath)
      else if (ctx.kind !== 'blank') await window.studio?.revealInFolder(ctx.module.filePath)
      return
    case 'refresh':
      await workspace.refreshActive()
      return
    case 'initGit': {
      if (ctx.kind !== 'project') return
      const root = ctx.project.rootPath
      await window.studio?.gitInit?.(root)
      await refreshGitFor(root)
      await workspace.refreshActive()
      return
    }
    case 'renameProject': {
      if (ctx.kind !== 'project') return
      const { index, value } = await modal.show({
        title: t('workspace.treeMenu.renameProject'),
        input: true,
        inputValue: ctx.project.name,
        buttons: [t('dialog.ok'), t('dialog.cancel')]
      })
      if (index !== 0 || !value?.trim() || value.trim() === ctx.project.name) return
      await workspace.renameProject(ctx.project.id, value.trim())
      return
    }
    case 'removeFromList': {
      if (ctx.kind !== 'project') return
      const { index } = await modal.show({
        title: t('workspace.treeMenu.removeFromList'),
        message: t('workspace.treeMenu.removeFromListConfirm', { name: ctx.project.name }),
        buttons: [t('workspace.treeMenu.removeFromList'), t('workspace.cancel')]
      })
      if (index !== 0) return
      await workspace.removeFromList(ctx.project.id)
      return
    }
    case 'revealInCode': {
      if (ctx.kind === 'blank' || ctx.kind === 'project') return
      if (ctx.project.id !== workspace.activeProjectId) {
        const ok = await workspace.requestActivateProject(ctx.project)
        if (!ok) return
      }
      workspace.selectModule(ctx.module.name)
      workspace.hybridMode = 'code'
      const tab = doc.documentTabs.find(
        (x) => x.filePath && filePathsEqual(x.filePath, ctx.module.filePath)
      )
      if (tab) doc.setActive(tab.id)
      return
    }
    case 'renameModule': {
      if (ctx.kind === 'blank' || ctx.kind === 'project') return
      if (!visual) return
      if (ctx.project.id !== workspace.activeProjectId) {
        const ok = await workspace.requestActivateProject(ctx.project)
        if (!ok) return
      }
      workspace.selectModule(ctx.module.name)
      const { index, value } = await modal.show({
        title: t('workspace.treeMenu.renameModule'),
        input: true,
        inputValue: ctx.module.name,
        buttons: [t('dialog.ok'), t('dialog.cancel')]
      })
      if (index !== 0 || !value?.trim() || value.trim() === ctx.module.name) return
      await visual.patchModule({
        action: 'rename',
        moduleName: ctx.module.name,
        newName: value.trim()
      })
      workspace.selectModule(value.trim())
      await workspace.resyncModulesFromOpenTabs()
      return
    }
    case 'deleteModule': {
      if (ctx.kind === 'blank' || ctx.kind === 'project') return
      if (!visual) return
      const { index } = await modal.show({
        title: t('workspace.treeMenu.deleteModule'),
        message: t('workspace.treeMenu.deleteModuleConfirm', { name: ctx.module.displayName }),
        buttons: [t('workspace.treeMenu.deleteModule'), t('workspace.cancel')]
      })
      if (index !== 0) return
      if (ctx.project.id !== workspace.activeProjectId) {
        const ok = await workspace.requestActivateProject(ctx.project)
        if (!ok) return
      }
      await visual.patchModule({ action: 'remove', moduleName: ctx.module.name })
      await workspace.resyncModulesFromOpenTabs()
      return
    }
    case 'addSubmodule':
      return
  }
}
