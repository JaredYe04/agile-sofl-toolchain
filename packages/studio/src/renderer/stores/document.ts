import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  createDocumentTab,
  createHomeTab,
  filePathsEqual,
  HOME_TAB_ID,
  pathToFileUri,
  type EditorTab
} from './tabUtils'
import { useRecentFilesStore } from './recentFiles'
import { useDocumentHistoryStore } from './documentHistory'
import { persistWorkspace, restoreWorkspace } from './workspaceSession'

export const useDocumentStore = defineStore('document', () => {
  const tabs = ref<EditorTab[]>([createHomeTab()])
  const activeTabId = ref<string>(HOME_TAB_ID)

  const homeTab = computed(() => tabs.value.find((t) => t.kind === 'home') ?? null)
  const documentTabs = computed(() => tabs.value.filter((t) => t.kind === 'document'))
  const activeTab = computed(() => tabs.value.find((t) => t.id === activeTabId.value) ?? null)
  const hasDirtyTabs = computed(() => documentTabs.value.some((t) => t.isDirty))
  const isHomeActive = computed(() => activeTabId.value === HOME_TAB_ID)
  const showWelcomeFallback = computed(
    () => documentTabs.value.length === 0 && activeTabId.value !== HOME_TAB_ID
  )

  function ensureHomeTab(): void {
    if (!tabs.value.some((t) => t.id === HOME_TAB_ID)) {
      tabs.value.unshift(createHomeTab())
    }
  }

  function initHome(): void {
    ensureHomeTab()
    activeTabId.value = HOME_TAB_ID
  }

  function restoreFromSession(): boolean {
    const restored = restoreWorkspace()
    if (!restored) return false
    tabs.value = restored.tabs
    activeTabId.value = restored.activeTabId
    ensureHomeTab()
    return true
  }

  function saveSession(): void {
    persistWorkspace(activeTabId.value, tabs.value)
  }

  function setActive(id: string): void {
    if (tabs.value.some((t) => t.id === id)) activeTabId.value = id
  }

  function goHome(): void {
    ensureHomeTab()
    activeTabId.value = HOME_TAB_ID
  }

  function newTab(options?: { content?: string; title?: string }): EditorTab {
    const tab = createDocumentTab({
      content: options?.content,
      title: options?.title
    })
    tabs.value.push(tab)
    activeTabId.value = tab.id
    saveSession()
    return tab
  }

  function setContent(id: string, content: string, dirty = true): void {
    const tab = tabs.value.find((t) => t.id === id)
    if (!tab || tab.kind !== 'document') return
    tab.content = content
    tab.isDirty = dirty
    saveSession()
  }

  function openFromFile(filePath: string, content: string, title: string): EditorTab {
    const recent = useRecentFilesStore()
    recent.add(filePath, title)

    const existing = documentTabs.value.find(
      (t) => t.filePath && filePathsEqual(t.filePath, filePath)
    )
    if (existing) {
      activeTabId.value = existing.id
      return existing
    }
    const tab = createDocumentTab({ filePath, content, title, isDirty: false })
    tabs.value.push(tab)
    activeTabId.value = tab.id
    saveSession()
    return tab
  }

  function updateContent(id: string, content: string): void {
    const tab = tabs.value.find((t) => t.id === id)
    if (!tab || tab.kind !== 'document') return
    tab.content = content
    tab.isDirty = true
    saveSession()
  }

  function markSaved(id: string, filePath: string, title: string): void {
    const tab = tabs.value.find((t) => t.id === id)
    if (!tab || tab.kind !== 'document') return
    tab.filePath = filePath
    tab.title = title
    tab.isDirty = false
    tab.uri = pathToFileUri(filePath)
    useRecentFilesStore().add(filePath, title)
    saveSession()
  }

  function removeTab(id: string): void {
    if (id === HOME_TAB_ID) return
    const idx = tabs.value.findIndex((t) => t.id === id)
    if (idx === -1) return
    useDocumentHistoryStore().removeTab(id)
    tabs.value.splice(idx, 1)

    if (activeTabId.value === id) {
      const remainingDocs = documentTabs.value
      if (remainingDocs.length > 0) {
        activeTabId.value = remainingDocs[Math.min(idx - 1, remainingDocs.length - 1)]?.id ?? remainingDocs[0].id
      } else {
        activeTabId.value = HOME_TAB_ID
      }
    }
    ensureHomeTab()
    saveSession()
  }

  return {
    tabs,
    activeTabId,
    homeTab,
    documentTabs,
    activeTab,
    hasDirtyTabs,
    isHomeActive,
    showWelcomeFallback,
    initHome,
    restoreFromSession,
    saveSession,
    setActive,
    goHome,
    newTab,
    setContent,
    openFromFile,
    updateContent,
    markSaved,
    removeTab
  }
})
