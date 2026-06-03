import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { createTab, type EditorTab, pathToFileUri } from './tabUtils'

export const useDocumentStore = defineStore('document', () => {
  const tabs = ref<EditorTab[]>([])
  const activeTabId = ref<string | null>(null)

  const activeTab = computed(() => tabs.value.find((t) => t.id === activeTabId.value) ?? null)
  const hasDirtyTabs = computed(() => tabs.value.some((t) => t.isDirty))

  function ensureInitialTab(): void {
    if (tabs.value.length === 0) {
      const tab = createTab()
      tabs.value.push(tab)
      activeTabId.value = tab.id
    }
  }

  function setActive(id: string): void {
    if (tabs.value.some((t) => t.id === id)) activeTabId.value = id
  }

  function newTab(): EditorTab {
    const tab = createTab()
    tabs.value.push(tab)
    activeTabId.value = tab.id
    return tab
  }

  function openFromFile(filePath: string, content: string, title: string): EditorTab {
    const existing = tabs.value.find((t) => t.filePath === filePath)
    if (existing) {
      activeTabId.value = existing.id
      return existing
    }
    const tab = createTab({ filePath, content, title, isDirty: false })
    tabs.value.push(tab)
    activeTabId.value = tab.id
    return tab
  }

  function updateContent(id: string, content: string): void {
    const tab = tabs.value.find((t) => t.id === id)
    if (!tab) return
    tab.content = content
    tab.isDirty = true
  }

  function markSaved(id: string, filePath: string, title: string): void {
    const tab = tabs.value.find((t) => t.id === id)
    if (!tab) return
    tab.filePath = filePath
    tab.title = title
    tab.isDirty = false
    tab.uri = pathToFileUri(filePath)
  }

  function removeTab(id: string): void {
    const idx = tabs.value.findIndex((t) => t.id === id)
    if (idx === -1) return
    tabs.value.splice(idx, 1)
    if (activeTabId.value === id) {
      activeTabId.value = tabs.value[Math.min(idx, tabs.value.length - 1)]?.id ?? null
    }
    if (tabs.value.length === 0) ensureInitialTab()
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    hasDirtyTabs,
    ensureInitialTab,
    setActive,
    newTab,
    openFromFile,
    updateContent,
    markSaved,
    removeTab
  }
})
