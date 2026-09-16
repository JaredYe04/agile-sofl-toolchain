import type { IndexedProject, ProjectModuleInfo } from '../../preload/index'

export type WorkspaceTreeContext =
  | { kind: 'blank' }
  | { kind: 'project'; project: IndexedProject }
  | { kind: 'systemModule'; project: IndexedProject; module: ProjectModuleInfo }
  | { kind: 'module'; project: IndexedProject; module: ProjectModuleInfo }

export type WorkspaceTreeActionId =
  | 'newProject'
  | 'openProject'
  | 'switchToProject'
  | 'collapseAll'
  | 'copyName'
  | 'copyPath'
  | 'revealInFolder'
  | 'refresh'
  | 'initGit'
  | 'renameProject'
  | 'removeFromList'
  | 'revealInCode'
  | 'renameModule'
  | 'deleteModule'
  | 'addSubmodule'

export interface WorkspaceTreeMenuItem {
  id: WorkspaceTreeActionId
  labelKey: string
  disabled?: boolean
  separator?: boolean
}

export interface WorkspaceTreeMenuProvider {
  id: string
  priority: number
  isEnabled?: (ctx: WorkspaceTreeContext) => boolean
  items: (ctx: WorkspaceTreeContext) => WorkspaceTreeMenuItem[]
}
