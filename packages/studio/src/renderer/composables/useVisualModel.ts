import { ref, watch, computed, onUnmounted, type ComputedRef } from 'vue'
import type {
  PatchDeclarationPayload,
  PatchProcessPayload,
  VisualModelPayload,
  DiagnosticSummary
} from '../../preload/index'
import { useDocumentStore } from '../stores/document'
import { useDocumentHistoryStore } from '../stores/documentHistory'

export function useVisualModel(activeTabId: ComputedRef<string | undefined>) {
  const doc = useDocumentStore()
  const history = useDocumentHistoryStore()
  const model = ref<VisualModelPayload | null>(null)
  const parseFailed = ref(false)
  const hasDiagnostics = ref(false)
  const loading = ref(false)
  const modelGen = ref(0)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let lastRebuiltContent: string | null = null
  let requestGen = 0

  const activeSource = computed(() => {
    const tab = doc.activeTab
    return tab?.kind === 'document' ? tab.content : ''
  })

  const moduleGraph = computed(() => model.value?.moduleGraph ?? null)
  const diagnostics = computed(
    () => (model.value?.diagnostics ?? []) as DiagnosticSummary[]
  )

  async function resetChannel(tabId: string): Promise<void> {
    if (window.studio?.resetVisualChannel) {
      await window.studio.resetVisualChannel(tabId)
    }
  }

  async function rebuild(source: string, tabId: string, resetIncremental = false): Promise<void> {
    if (!window.studio?.buildVisualModel) return
    if (resetIncremental) await resetChannel(tabId)
    const gen = ++requestGen
    loading.value = true
    try {
      const result = await window.studio.buildVisualModel(source, tabId)
      if (gen !== requestGen) return
      model.value = result
      parseFailed.value = result.parseFailed
      hasDiagnostics.value = result.hasDiagnostics ?? false
      lastRebuiltContent = source
      modelGen.value++
    } finally {
      if (gen === requestGen) loading.value = false
    }
  }

  async function rebuildNow(): Promise<void> {
    const tab = doc.activeTab
    if (!tab || tab.kind !== 'document') return
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    await rebuild(tab.content, tab.id, true)
  }

  function scheduleRebuild(): void {
    const tab = doc.activeTab
    if (!tab || tab.kind !== 'document') {
      model.value = null
      return
    }
    const source = tab.content
    if (source === lastRebuiltContent) return

    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      const current = doc.activeTab
      if (!current || current.kind !== 'document') return
      if (current.content === lastRebuiltContent) return
      void rebuild(current.content, current.id, false)
    }, 300)
  }

  async function applySourcePatch(mutator: (source: string) => Promise<string>): Promise<void> {
    const tab = doc.activeTab
    if (!tab || tab.kind !== 'document') return
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    const next = await mutator(tab.content)
    if (next === tab.content) return
    history.pushSnapshot(tab.id, tab.content, true)
    doc.setContent(tab.id, next)
    history.applyExternalContent(tab.id, next)
    await rebuild(next, tab.id, false)
  }

  async function patchDeclaration(payload: Omit<PatchDeclarationPayload, 'source'>): Promise<void> {
    await applySourcePatch(async (source) => {
      if (!window.studio?.patchDeclaration) return source
      return window.studio.patchDeclaration({ ...payload, source })
    })
  }

  async function patchProcess(payload: Omit<PatchProcessPayload, 'source'>): Promise<void> {
    await applySourcePatch(async (source) => {
      if (!window.studio?.patchProcess) return source
      return window.studio.patchProcess({ ...payload, source })
    })
  }

  watch(activeSource, () => scheduleRebuild(), { immediate: true })

  watch(parseFailed, (failed, wasFailed) => {
    if (wasFailed && !failed) void rebuildNow()
  })

  watch(activeTabId, (id, prev) => {
    if (prev && window.studio?.resetVisualChannel) void window.studio.resetVisualChannel(prev)
    lastRebuiltContent = null
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
    hasDiagnostics,
    loading,
    modelGen,
    moduleGraph,
    diagnostics,
    applySourcePatch,
    patchDeclaration,
    patchProcess,
    rebuildNow,
    fsfModels: computed(() => model.value?.fsfModels ?? [])
  }
}

export type TreeSelection =
  | { kind: 'module'; moduleName: string }
  | { kind: 'process'; moduleName: string; processName: string }
  | { kind: 'function'; moduleName: string; functionName: string }
  | null
