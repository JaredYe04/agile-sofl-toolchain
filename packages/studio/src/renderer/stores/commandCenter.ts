import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import type { RevealSpanFn } from '../composables/useCodeNavigation'
import { useDocumentStore } from './document'
import { useRecentFilesStore } from './recentFiles'
import { queryCommandCenter } from '../commandCenter/registry'
import type { CommandCenterContext, CommandCenterItem } from '../commandCenter/types'
import { initCommandCenterProviders } from '../commandCenter/init'
import { i18n } from '../i18n'

export const useCommandCenterStore = defineStore('commandCenter', () => {
  const isOpen = ref(false)
  const query = ref('')
  const selectedIndex = ref(0)
  const results = ref<CommandCenterItem[]>([])
  const loading = ref(false)

  const revealSpanHandler = shallowRef<RevealSpanFn | null>(null)
  const formatHandler = shallowRef<(() => Promise<boolean>) | null>(null)
  const undoRedoHandler = shallowRef<((cmd: 'undo' | 'redo') => boolean) | null>(null)
  const editHandler = shallowRef<((cmd: string) => void) | null>(null)
  const newFileHandler = shallowRef<(() => void) | null>(null)
  const openFileHandler = shallowRef<(() => Promise<void>) | null>(null)
  const saveTabHandler = shallowRef<(() => Promise<boolean>) | null>(null)
  const saveAsTabHandler = shallowRef<(() => Promise<boolean>) | null>(null)
  const closeActiveTabHandler = shallowRef<(() => Promise<void>) | null>(null)
  const devToolsHandler = shallowRef<(() => void) | null>(null)

  initCommandCenterProviders()

  function registerHandlers(handlers: {
    revealSpan: RevealSpanFn
    formatDocument: () => Promise<boolean>
    undoRedo: (cmd: 'undo' | 'redo') => boolean
    runEdit: (cmd: string) => void
    openNewFile: () => void
    openFile: () => Promise<void>
    saveTab: () => Promise<boolean>
    saveAsTab: () => Promise<boolean>
    closeActiveTab: () => Promise<void>
    openDevTools: () => void
  }): void {
    revealSpanHandler.value = handlers.revealSpan
    formatHandler.value = handlers.formatDocument
    undoRedoHandler.value = handlers.undoRedo
    editHandler.value = handlers.runEdit
    newFileHandler.value = handlers.openNewFile
    openFileHandler.value = handlers.openFile
    saveTabHandler.value = handlers.saveTab
    saveAsTabHandler.value = handlers.saveAsTab
    closeActiveTabHandler.value = handlers.closeActiveTab
    devToolsHandler.value = handlers.openDevTools
  }

  function buildContext(t: (key: string, params?: Record<string, unknown>) => string): CommandCenterContext {
    const doc = useDocumentStore()
    const recent = useRecentFilesStore()
    return {
      activeTab: doc.activeTab,
      documentTabs: doc.documentTabs,
      recentFiles: recent.items,
      revealSpan: (span) => revealSpanHandler.value?.(span),
      formatDocument: () => formatHandler.value?.() ?? Promise.resolve(false),
      undoRedo: (cmd) => undoRedoHandler.value?.(cmd) ?? false,
      runEdit: (cmd) => editHandler.value?.(cmd),
      openNewFile: () => newFileHandler.value?.(),
      openFile: () => openFileHandler.value?.() ?? Promise.resolve(),
      saveTab: () => saveTabHandler.value?.() ?? Promise.resolve(false),
      saveAsTab: () => saveAsTabHandler.value?.() ?? Promise.resolve(false),
      closeActiveTab: () => closeActiveTabHandler.value?.() ?? Promise.resolve(),
      openDevTools: () => devToolsHandler.value?.(),
      t
    }
  }

  async function refreshResults(): Promise<void> {
    loading.value = true
    try {
      const t = i18n.global.t as (key: string, params?: Record<string, unknown>) => string
      const items = await queryCommandCenter(query.value, buildContext(t))
      results.value = items
      if (selectedIndex.value >= items.length) {
        selectedIndex.value = Math.max(0, items.length - 1)
      }
    } finally {
      loading.value = false
    }
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleRefresh(): void {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      void refreshResults()
    }, 80)
  }

  watch(query, () => {
    selectedIndex.value = 0
    scheduleRefresh()
  })

  const groupedResults = computed(() => {
    const groups = new Map<string, CommandCenterItem[]>()
    for (const item of results.value) {
      const key = item.group ?? 'commandCenter.group.default'
      const list = groups.get(key) ?? []
      list.push(item)
      groups.set(key, list)
    }
    return groups
  })

  function open(initialQuery = ''): void {
    query.value = initialQuery
    selectedIndex.value = 0
    isOpen.value = true
    void refreshResults()
  }

  function close(): void {
    isOpen.value = false
    query.value = ''
    selectedIndex.value = 0
    results.value = []
  }

  async function executeItem(item: CommandCenterItem): Promise<void> {
    const t = i18n.global.t as (key: string, params?: Record<string, unknown>) => string
    const ctx = buildContext(t)
    try {
      await item.execute(ctx)
    } finally {
      close()
    }
  }

  async function executeSelected(): Promise<void> {
    const item = results.value[selectedIndex.value]
    if (!item) return
    await executeItem(item)
  }

  function moveSelection(delta: number): void {
    if (!results.value.length) return
    selectedIndex.value = (selectedIndex.value + delta + results.value.length) % results.value.length
  }

  return {
    isOpen,
    query,
    selectedIndex,
    results,
    loading,
    groupedResults,
    registerHandlers,
    open,
    close,
    refreshResults,
    executeSelected,
    executeItem,
    moveSelection
  }
})
