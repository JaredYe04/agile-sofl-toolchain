import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type {
  IndexedProject,
  ProjectModuleInfo,
  ProjectUiState,
  WorkspaceScanPayload
} from '../../preload/index'
import { useDocumentStore } from './document'
import { dirtyModuleNames } from '../lib/moduleDirty'
import type { TreeSelection } from '../composables/useVisualModel'
import { filePathsEqual } from './tabUtils'

const DEFAULT_COLUMN_WIDTHS = [0.18, 0.22, 0.38, 0.22]

export const useWorkspaceStore = defineStore('workspace', () => {
  const doc = useDocumentStore()
  const projects = ref<IndexedProject[]>([])
  const activeProjectId = ref<string | null>(null)
  const scan = ref<WorkspaceScanPayload | null>(null)
  const selectedModuleName = ref<string | null>(null)
  const selection = ref<TreeSelection>(null)
  const informalCollapsed = ref(false)
  const columnWidths = ref<number[]>([...DEFAULT_COLUMN_WIDTHS])
  const expandedProjectIds = ref<string[]>([])
  const hybridMode = ref<'code' | 'visual'>('visual')
  const guiMode = ref<'visual' | 'code'>('visual')
  const structureMode = ref<'tree' | 'graph'>('tree')
  const savedModuleHashes = ref<Record<string, Record<string, string>>>({})
  const currentModuleHashes = ref<Record<string, Record<string, string>>>({})
  const loading = ref(false)
  const cachedModulesByProject = ref<Record<string, ProjectModuleInfo[]>>({})

  const activeProject = computed(
    () => projects.value.find((p) => p.id === activeProjectId.value) ?? null
  )
  const modules = computed(() => scan.value?.modules ?? [])
  const selectedModule = computed(
    () => modules.value.find((m) => m.name === selectedModuleName.value) ?? null
  )
  const isGuiModuleSelected = computed(() => Boolean(selectedModule.value?.isGui))
  const hasWorkspace = computed(() => Boolean(activeProjectId.value && scan.value))

  const informalTab = computed(() => {
    const path = scan.value?.files.find((f) => f.kind === 'aspec')?.path
    if (!path) return undefined
    return doc.documentTabs.find((t) => t.filePath && filePathsEqual(t.filePath, path))
  })

  const hybridTab = computed(() => {
    const path = selectedModule.value?.filePath ?? scan.value?.files.find((f) => f.kind === 'asfl')?.path
    if (!path) return undefined
    return doc.documentTabs.find((t) => t.filePath && filePathsEqual(t.filePath, path))
  })

  const guiTab = computed(() => {
    const path = scan.value?.files.find((f) => f.kind === 'guispec')?.path
    if (!path) return undefined
    return doc.documentTabs.find((t) => t.filePath && filePathsEqual(t.filePath, path))
  })

  const dirtyNames = computed(() =>
    dirtyModuleNames(modules.value, savedModuleHashes.value, currentModuleHashes.value)
  )

  function isModuleDirty(name: string): boolean {
    return dirtyNames.value.includes(name)
  }

  function isInformalDirty(): boolean {
    return Boolean(informalTab.value?.isDirty)
  }

  function isGuiDirty(): boolean {
    return Boolean(guiTab.value?.isDirty)
  }

  async function refreshProjects(): Promise<void> {
    if (!window.studio?.projectList) return
    projects.value = await window.studio.projectList()
  }

  function modulesFor(projectId: string): ProjectModuleInfo[] {
    if (projectId === activeProjectId.value) return modules.value
    return cachedModulesByProject.value[projectId] ?? []
  }

  async function refreshCachedModules(): Promise<void> {
    if (!window.studio?.projectCachedModules) return
    const next: Record<string, ProjectModuleInfo[]> = { ...cachedModulesByProject.value }
    for (const project of projects.value) {
      next[project.id] = await window.studio.projectCachedModules(project.id)
    }
    cachedModulesByProject.value = next
  }

  async function persistUi(): Promise<void> {
    const id = activeProjectId.value
    if (!id || !window.studio?.projectSaveUiState) return
    const state: ProjectUiState = {
      informalCollapsed: Boolean(informalCollapsed.value),
      columnWidths: [...columnWidths.value],
      selectedModuleName:
        typeof selectedModuleName.value === 'string' ? selectedModuleName.value : null,
      expanded: expandedProjectIds.value.includes(id)
    }
    const payload = JSON.parse(JSON.stringify(state)) as ProjectUiState
    try {
      await window.studio.projectSaveUiState(String(id), payload)
    } catch (err) {
      console.warn('[studio] failed to persist project UI state:', err)
    }
  }

  async function refreshHashes(): Promise<void> {
    if (!window.studio?.moduleHashes) return
    const next: Record<string, Record<string, string>> = {}
    for (const file of scan.value?.files.filter((f) => f.kind === 'asfl') ?? []) {
      const tab = doc.documentTabs.find((t) => t.filePath && filePathsEqual(t.filePath, file.path))
      if (!tab) continue
      next[file.path] = await window.studio.moduleHashes(tab.content)
    }
    currentModuleHashes.value = next
  }

  async function loadProjectFiles(payload: WorkspaceScanPayload): Promise<void> {
    for (const file of payload.files) {
      if (file.kind === 'manifest') continue
      const result = await window.studio!.fileRead(file.path)
      doc.openFromFile(result.filePath, result.content, result.title)
    }
    const saved: Record<string, Record<string, string>> = {}
    for (const file of payload.files.filter((f) => f.kind === 'asfl')) {
      const tab = doc.documentTabs.find((t) => t.filePath && filePathsEqual(t.filePath, file.path))
      if (!tab || !window.studio?.moduleHashes) continue
      saved[file.path] = await window.studio.moduleHashes(tab.content)
    }
    savedModuleHashes.value = saved
    currentModuleHashes.value = { ...saved }
  }

  async function activateProject(project: IndexedProject): Promise<void> {
    if (!window.studio?.workspaceScan) return
    loading.value = true
    try {
      activeProjectId.value = project.id
      await window.studio.projectTouch?.(project.id)
      const payload = await window.studio.workspaceScan(project.rootPath)
      scan.value = payload
      await window.studio.projectCacheModules?.(project.id, payload.modules)
      cachedModulesByProject.value = { ...cachedModulesByProject.value, [project.id]: payload.modules }
      const ui = await window.studio.projectUiState?.(project.id)
      if (ui) {
        informalCollapsed.value = ui.informalCollapsed
        columnWidths.value = ui.columnWidths?.length === 4 ? ui.columnWidths : [...DEFAULT_COLUMN_WIDTHS]
        if (ui.expanded && !expandedProjectIds.value.includes(project.id)) {
          expandedProjectIds.value = [...expandedProjectIds.value, project.id]
        }
      } else if (!expandedProjectIds.value.includes(project.id)) {
        expandedProjectIds.value = [...expandedProjectIds.value, project.id]
      }
      await loadProjectFiles(payload)
      const preferred = ui?.selectedModuleName
      const nextModule =
        payload.modules.find((m) => m.name === preferred)?.name ?? payload.modules[0]?.name ?? null
      selectModule(nextModule)
    } finally {
      loading.value = false
    }
  }

  async function init(): Promise<boolean> {
    await refreshProjects()
    await refreshCachedModules()
    const first = projects.value[0]
    if (!first) return false
    expandedProjectIds.value = projects.value.map((p) => p.id)
    await activateProject(first)
    return true
  }

  async function createProject(name: string): Promise<boolean> {
    const result = await window.studio?.projectCreate?.(name)
    if (!result) return false
    await refreshProjects()
    await activateProject(result.project)
    return true
  }

  async function createProjectFromTemplate(name: string, templateId: string): Promise<boolean> {
    const result = await window.studio?.projectCreateFromTemplate?.(name, templateId)
    if (!result) return false
    await refreshProjects()
    await activateProject(result.project)
    return true
  }

  async function openProjectFolder(): Promise<boolean> {
    const result = await window.studio?.projectOpenFolder?.()
    if (!result) return false
    await refreshProjects()
    await activateProject(result.project)
    return true
  }

  async function removeFromList(projectId: string): Promise<void> {
    await window.studio?.projectRemove?.(projectId)
    if (activeProjectId.value === projectId) {
      activeProjectId.value = null
      scan.value = null
      selectedModuleName.value = null
      selection.value = null
    }
    await refreshProjects()
    if (!activeProjectId.value && projects.value[0]) {
      await activateProject(projects.value[0])
    }
  }

  async function refreshActive(): Promise<void> {
    const project = activeProject.value
    if (!project) return
    await activateProject(project)
  }

  function selectModule(name: string | null, extra?: TreeSelection): void {
    selectedModuleName.value = name
    if (extra) selection.value = extra
    else if (name) selection.value = { kind: 'module', moduleName: name }
    else selection.value = null
    const tab = hybridTab.value
    if (tab) doc.setActive(tab.id)
    void persistUi()
  }

  function collapseAllProjects(): void {
    expandedProjectIds.value = []
    void persistUi()
  }

  async function renameProject(projectId: string, name: string): Promise<boolean> {
    const next = await window.studio?.projectRename?.(projectId, name)
    if (!next) return false
    await refreshProjects()
    return true
  }

  function toggleProjectExpanded(id: string): void {
    if (expandedProjectIds.value.includes(id)) {
      expandedProjectIds.value = expandedProjectIds.value.filter((x) => x !== id)
    } else {
      expandedProjectIds.value = [...expandedProjectIds.value, id]
    }
  }

  function setInformalCollapsed(v: boolean): void {
    informalCollapsed.value = v
    void persistUi()
  }

  function setColumnWidths(widths: number[]): void {
    columnWidths.value = widths
    void persistUi()
  }

  async function markHybridSaved(filePath: string): Promise<void> {
    if (!window.studio?.moduleHashes) return
    const tab = doc.documentTabs.find((t) => t.filePath && filePathsEqual(t.filePath, filePath))
    if (!tab) return
    const hashes = await window.studio.moduleHashes(tab.content)
    savedModuleHashes.value = { ...savedModuleHashes.value, [filePath]: hashes }
    currentModuleHashes.value = { ...currentModuleHashes.value, [filePath]: hashes }
  }

  watch(
    () =>
      doc.documentTabs
        .filter((t) => t.documentKind === 'asfl')
        .map((t) => `${t.filePath}:${t.content.length}:${t.isDirty}`)
        .join('|'),
    () => {
      void refreshHashes()
    }
  )

  return {
    projects,
    activeProjectId,
    activeProject,
    scan,
    modules,
    selectedModuleName,
    selectedModule,
    selection,
    informalCollapsed,
    columnWidths,
    expandedProjectIds,
    hybridMode,
    guiMode,
    structureMode,
    loading,
    hasWorkspace,
    isGuiModuleSelected,
    informalTab,
    hybridTab,
    guiTab,
    dirtyNames,
    isModuleDirty,
    isInformalDirty,
    isGuiDirty,
    refreshProjects,
    init,
    createProject,
    createProjectFromTemplate,
    openProjectFolder,
    activateProject,
    removeFromList,
    refreshActive,
    selectModule,
    modulesFor,
    toggleProjectExpanded,
    collapseAllProjects,
    renameProject,
    setInformalCollapsed,
    setColumnWidths,
    markHybridSaved,
    persistUi
  }
})
