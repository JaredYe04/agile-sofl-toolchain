import { ref, watch, computed, onUnmounted, type ComputedRef } from 'vue'
import type { VisualModelPayload } from '../../preload/index'
import { useDocumentStore } from '../stores/document'

export function useVisualModel(activeTabId: ComputedRef<string | undefined>) {
  const doc = useDocumentStore()
  const model = ref<VisualModelPayload | null>(null)
  const parseFailed = ref(false)
  const loading = ref(false)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let skipNextParse = false
  let requestGen = 0

  const activeSource = computed(() => {
    const tab = doc.activeTab
    return tab?.kind === 'document' ? tab.content : ''
  })

  async function rebuild(source: string, tabId: string): Promise<void> {
    if (!window.studio?.buildVisualModel) return
    const gen = ++requestGen
    loading.value = true
    try {
      const result = await window.studio.buildVisualModel(source, tabId)
      if (gen !== requestGen) return
      model.value = result
      parseFailed.value = result.parseFailed
    } finally {
      if (gen === requestGen) loading.value = false
    }
  }

  function scheduleRebuild(): void {
    const tab = doc.activeTab
    if (!tab || tab.kind !== 'document') {
      model.value = null
      return
    }
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      if (skipNextParse) {
        skipNextParse = false
        return
      }
      void rebuild(tab.content, tab.id)
    }, 300)
  }

  async function applySourcePatch(mutator: (source: string) => Promise<string>): Promise<void> {
    const tab = doc.activeTab
    if (!tab || tab.kind !== 'document') return
    skipNextParse = true
    const next = await mutator(tab.content)
    if (next === tab.content) return
    doc.setContent(tab.id, next)
    await rebuild(next, tab.id)
  }

  watch(activeSource, () => scheduleRebuild(), { immediate: true })

  watch(activeTabId, (id, prev) => {
    if (prev && window.studio?.resetVisualChannel) void window.studio.resetVisualChannel(prev)
    scheduleRebuild()
  })

  onUnmounted(() => {
    if (debounceTimer) clearTimeout(debounceTimer)
    const id = activeTabId.value
    if (id && window.studio?.resetVisualChannel) void window.studio.resetVisualChannel(id)
  })

  return {
    model,
    parseFailed,
    loading,
    applySourcePatch,
    fsfModels: computed(() => model.value?.fsfModels ?? [])
  }
}

export type TreeSelection =
  | { kind: 'module'; moduleName: string }
  | { kind: 'process'; moduleName: string; processName: string }
  | { kind: 'function'; moduleName: string; functionName: string }
  | null
