export const MANIFEST_FILENAME = '.agile-sofl.json'

export interface AgileSoflManifest {
  version: '1.0'
  name: string
  guiModule?: string
  informal: string
  hybrid: string[]
  gui?: string
}

export interface IndexedProject {
  id: string
  name: string
  rootPath: string
  lastOpenedAt: number
  createdAt: number
}

export type ProjectModuleMemberKind =
  | 'const'
  | 'type'
  | 'var'
  | 'inv'
  | 'process'
  | 'function'
  | 'gui-screen'

export interface ProjectModuleMember {
  kind: ProjectModuleMemberKind
  name: string
  spanStart: number
  spanEnd: number
}

export interface ProjectModuleInfo {
  name: string
  displayName: string
  filePath: string
  isSystem: boolean
  isGui: boolean
  parentName?: string
  spanStart: number
  spanEnd: number
  members?: ProjectModuleMember[]
}

export interface ProjectFileInfo {
  kind: 'aspec' | 'asfl' | 'guispec' | 'manifest'
  path: string
  contentHash?: string
}

export interface WorkspaceScanPayload {
  root: string
  manifest: AgileSoflManifest
  files: ProjectFileInfo[]
  modules: ProjectModuleInfo[]
}

export interface ProjectUiState {
  informalCollapsed: boolean
  columnWidths: number[]
  selectedModuleName: string | null
  expanded: boolean
}

export const DEFAULT_COLUMN_WIDTHS = [0.18, 0.6, 0.22]
