import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type {
  HybridAgentBootstrapPayload,
  IndexedProject,
  ProjectModuleInfo,
  ProjectUiState,
  WorkspaceScanPayload
} from '../../preload/index'
import { useDocumentStore } from './document'
import { dirtyModuleNames } from '../lib/moduleDirty'
import type { TreeSelection } from '../composables/useVisualModel'
import { filePathsEqual } from './tabUtils'
import { refreshGitFor } from '../composables/useGitStatus'
import { consumeAgentLaunchPending, emitAgentLaunch } from '../lib/agentLaunchBus'
import {
  defaultDockLayout,
  parseDockLayout,
  serializeDockLayout,
  type DockNode
} from '../lib/dockLayout'

const DEFAULT_COLUMN_WIDTHS = [0.18, 0.6, 0.22]

export type WorkspacePanelId = 'tree' | 'informal' | 'agent' | 'hybrid' | 'gui' | 'structure'

function readStoredView<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback
  const raw = localStorage.getItem(key)
  return (allowed as readonly string[]).includes(raw ?? '') ? (raw as T) : fallback
}

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
  const hybridMode = ref<'code' | 'visual'>(
    readStoredView('studio-default-hybrid-view', ['code', 'visual'] as const, 'visual')
  )
  const guiMode = ref<'visual' | 'code'>('visual')
  const structureMode = ref<'tree' | 'graph'>('tree')
  const informalViewMode = ref<'document' | 'graphical'>(
    readStoredView('studio-default-informal-view', ['document', 'graphical'] as const, 'document')
  )
  const informalSelectedNodeId = ref<string | null>(null)
  const agentSplitRatio = ref(0.58)
  const dockLayout = ref<DockNode>(defaultDockLayout())
  const informalGraphBodyVisible = ref(true)
  const savedModuleHashes = ref<Record<string, Record<string, string>>>({})
  const currentModuleHashes = ref<Record<string, Record<string, string>>>({})
  const loading = ref(false)
  const cachedModulesByProject = ref<Record<string, ProjectModuleInfo[]>>({})
  const focusedPanel = ref<WorkspacePanelId | null>(null)

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

  function isHybridDirty(): boolean {
    return Boolean(hybridTab.value?.isDirty)
  }

  function isGuiDirty(): boolean {
    return Boolean(guiTab.value?.isDirty)
  }

  function tabForFocusedPanel() {
    switch (focusedPanel.value) {
      case 'informal':
      case 'agent':
        return informalTab.value
      case 'hybrid':
        return hybridTab.value
      case 'gui':
        return guiTab.value
      default:
        return undefined
    }
  }

  function setFocusedPanel(panel: WorkspacePanelId): void {
    focusedPanel.value = panel
    const tab = tabForFocusedPanel()
    if (tab) doc.setActive(tab.id)
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
      expanded: expandedProjectIds.value.includes(id),
    }
    const payload = JSON.parse(JSON.stringify(state)) as ProjectUiState
    try {
      await window.studio.projectSaveUiState(String(id), payload)
    } catch (err) {
      console.warn('[studio] failed to persist project UI state:', err)
    }
  }

  async function refreshHashes(): Promise<void> {
    if (typeof window === 'undefined' || !window.studio?.moduleHashes) return
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
    if (!window.studio?.workspaceScan) {
      void refreshGitFor(project.rootPath)
      return
    }
    loading.value = true
    const prevId = activeProjectId.value
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
        if (ui.columnWidths?.length === 3) {
          columnWidths.value = ui.columnWidths
        } else if (ui.columnWidths?.length === 4) {
          columnWidths.value = [
            ui.columnWidths[0] ?? 0.18,
            (ui.columnWidths[1] ?? 0.22) + (ui.columnWidths[2] ?? 0.38),
            ui.columnWidths[3] ?? 0.22
          ]
        } else {
          columnWidths.value = [...DEFAULT_COLUMN_WIDTHS]
        }
        if (ui.expanded && !expandedProjectIds.value.includes(project.id)) {
          expandedProjectIds.value = [...expandedProjectIds.value, project.id]
        }
      } else if (!expandedProjectIds.value.includes(project.id)) {
        expandedProjectIds.value = [...expandedProjectIds.value, project.id]
      }
      loadDockLayoutForProject(project.id)
      await loadProjectFiles(payload)
      if (prevId && prevId !== project.id) {
        const { useHistoryStore } = await import('./history')
        useHistoryStore().clear()
      }
      const preferred = ui?.selectedModuleName
      const nextModule =
        payload.modules.find((m) => m.name === preferred)?.name ?? payload.modules[0]?.name ?? null
      selectModule(nextModule)
    } finally {
      loading.value = false
      void refreshGitFor(project.rootPath)
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

  function dockLayoutStorageKey(projectId: string): string {
    return `studio-dock-layout:${projectId}`
  }

  function loadDockLayoutForProject(projectId: string): void {
    if (typeof localStorage === 'undefined') {
      dockLayout.value = defaultDockLayout()
      return
    }
    try {
      const raw = localStorage.getItem(dockLayoutStorageKey(projectId))
      dockLayout.value = raw ? parseDockLayout(JSON.parse(raw)) : defaultDockLayout()
    } catch {
      dockLayout.value = defaultDockLayout()
    }
  }

  function setDockLayout(node: DockNode): void {
    dockLayout.value = node
    const id = activeProjectId.value
    if (id && typeof localStorage !== 'undefined') {
      localStorage.setItem(dockLayoutStorageKey(id), JSON.stringify(serializeDockLayout(node)))
    }
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
      void resyncModulesFromOpenTabs()
    }
  )

  async function resyncModulesFromOpenTabs(): Promise<void> {
    if (typeof window === 'undefined' || !scan.value || !window.studio?.modulesFromSource) return
    const guiModule = scan.value.manifest.guiModule
    let modules = [...scan.value.modules]
    const asflTabs = doc.documentTabs.filter((t) => t.documentKind === 'asfl' && t.filePath)
    for (const tab of asflTabs) {
      const path = tab.filePath
      if (!path) continue
      const next = await window.studio.modulesFromSource({
        source: tab.content,
        filePath: path,
        guiModule
      })
      const looksLikeHybrid = /\b(?:module|system)\b/i.test(tab.content)
      if (next.length === 0 && looksLikeHybrid) {
        const prev = modules.filter((m) => filePathsEqual(m.filePath, path))
        if (prev.length > 0) continue
      }
      modules = modules.filter((m) => !filePathsEqual(m.filePath, path)).concat(next)
    }
    scan.value = { ...scan.value, modules }
    const projectId = activeProjectId.value
    if (projectId) {
      cachedModulesByProject.value = { ...cachedModulesByProject.value, [projectId]: modules }
      void window.studio.projectCacheModules?.(projectId, modules)
    }
    if (selectedModuleName.value && !modules.some((m) => m.name === selectedModuleName.value)) {
      const fallback = modules.find((m) => m.isSystem)?.name ?? modules[0]?.name ?? null
      selectModule(fallback)
    }
  }

  function requestAgentLaunch(req: HybridAgentBootstrapPayload): void {
    informalCollapsed.value = false
    if (agentSplitRatio.value > 0.78) agentSplitRatio.value = 0.58
    focusedPanel.value = 'agent'
    emitAgentLaunch(req)
  }

  function consumeAgentLaunch(): HybridAgentBootstrapPayload | null {
    return consumeAgentLaunchPending()
  }

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
    informalViewMode,
    informalSelectedNodeId,
    agentSplitRatio,
    dockLayout,
    informalGraphBodyVisible,
    setDockLayout,
    requestAgentLaunch,
    consumeAgentLaunch,
    focusedPanel,
    loading,
    hasWorkspace,
    isGuiModuleSelected,
    informalTab,
    hybridTab,
    guiTab,
    dirtyNames,
    isModuleDirty,
    isInformalDirty,
    isHybridDirty,
    isGuiDirty,
    tabForFocusedPanel,
    setFocusedPanel,
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
    persistUi,
    resyncModulesFromOpenTabs
  }
})
