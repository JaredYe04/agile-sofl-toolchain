import { ref, watch, computed, type Ref } from 'vue'
import { useDocumentStore } from '../stores/document'
import { useDocumentHistoryStore } from '../stores/documentHistory'
import type { GuiWidgetKind, PatchGuiPayload } from '../preload/index'

const DEBOUNCE_MS = 300

export function useGuiModel(
  activeTabId: Ref<string | undefined>,
  options?: {
    embeddedInAspec?: Ref<boolean>
    informalTabId?: Ref<string | undefined>
    informalMeta?: Ref<{ guiTarget?: string } | undefined>
  }
) {
  const doc = useDocumentStore()
  const history = useDocumentHistoryStore()
  const model = ref<Awaited<ReturnType<NonNullable<typeof window.studio>['buildGuiModel']>> | null>(null)
  const loading = ref(false)
  const lastRebuiltContent = ref('')
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const embedded = computed(() => options?.embeddedInAspec?.value ?? false)

  const activeTab = computed(() => {
    const id = activeTabId.value
    if (!id) return undefined
    const tab = doc.tabs.find((t) => t.id === id && t.kind === 'document')
    if (!tab) return undefined
    if (embedded.value) return tab.documentKind === 'aspec' ? tab : undefined
    return tab.documentKind === 'guispec' ? tab : undefined
  })

  const informalTab = computed(() => {
    const id = options?.informalTabId?.value ?? (embedded.value ? activeTabId.value : undefined)
    if (!id) return undefined
    return doc.tabs.find((t) => t.id === id && t.documentKind === 'aspec')
  })

  const hasErrors = computed(() =>
    (model.value?.diagnostics ?? []).some((d) => d.severity === 'error')
  )

  async function rebuildNow(): Promise<void> {
    const tab = activeTab.value
    if (!tab || !window.studio) return
    loading.value = true
    try {
      if (embedded.value && window.studio.resolveGuiForAspec) {
        let externalGui: string | undefined
        const guiTarget = options?.informalMeta?.value?.guiTarget
        if (tab.filePath && guiTarget && window.studio.fileRead) {
          try {
            const base = tab.filePath.replace(/[/\\][^/\\]+$/, '')
            const target = guiTarget.replace(/^\.\//, '')
            const file = await window.studio.fileRead(`${base}/${target}`.replace(/\\/g, '/'))
            externalGui = file.content
          } catch {
            externalGui = undefined
          }
        }
        model.value = await window.studio.resolveGuiForAspec({
          aspecSource: tab.content,
          externalGuiSource: externalGui
        })
      } else if (window.studio.buildGuiModel) {
        model.value = await window.studio.buildGuiModel({
          source: tab.content,
          informalSource: informalTab.value?.content
        })
      }
      lastRebuiltContent.value = tab.content
    } finally {
      loading.value = false
    }
  }

  function scheduleRebuild(): void {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => void rebuildNow(), DEBOUNCE_MS)
  }

  watch(
    () => activeTab.value?.content,
    (content) => {
      if (content == null) return
      if (content === lastRebuiltContent.value) return
      scheduleRebuild()
    },
    { immediate: true }
  )

  watch(activeTabId, () => void rebuildNow())

  function applySourcePatch(next: string): void {
    const tab = activeTab.value
    if (!tab) return
    doc.setContent(tab.id, next)
    history.pushSnapshot(tab.id, next)
    lastRebuiltContent.value = next
    void rebuildNow()
  }

  async function patchViaIpc(payload: PatchGuiPayload): Promise<void> {
    const tab = activeTab.value
    if (!tab || !window.studio) return
    let next: string
    if (embedded.value && window.studio.patchAspecGui) {
      next = await window.studio.patchAspecGui({ aspecSource: tab.content, action: payload })
    } else if (window.studio.patchGui) {
      next = await window.studio.patchGui({ source: tab.content, ...payload })
    } else {
      return
    }
    applySourcePatch(next)
  }

  async function patchById(idPath: string, value: unknown): Promise<void> {
    if (hasErrors.value) return
    await patchViaIpc({ action: 'patch-by-id', idPath, value })
  }

  async function formatYaml(): Promise<void> {
    const tab = activeTab.value
    if (!tab || !window.studio?.formatGui || embedded.value) return
    const next = await window.studio.formatGui(tab.content)
    applySourcePatch(next)
  }

  async function addScreen(screen: {
    id: string
    name: string
    title?: string
    widgets?: []
  }): Promise<void> {
    await patchViaIpc({ action: 'add-screen', screen: { ...screen, widgets: screen.widgets ?? [] } })
  }

  async function removeScreen(screenId: string): Promise<void> {
    await patchViaIpc({ action: 'remove-screen', screenId })
  }

  async function addWidget(
    screenId: string,
    widget: { id: string; kind: GuiWidgetKind; label?: string }
  ): Promise<void> {
    await patchViaIpc({ action: 'add-widget', screenId, widget })
  }

  async function removeWidget(widgetId: string): Promise<void> {
    await patchViaIpc({ action: 'remove-widget', widgetId })
  }

  async function addFlow(flow: { from: string; to: string; on?: string }): Promise<void> {
    await patchViaIpc({ action: 'add-flow', flow })
  }

  return {
    model,
    loading,
    hasErrors,
    embedded,
    rebuildNow,
    patchById,
    formatYaml,
    addScreen,
    removeScreen,
    addWidget,
    removeWidget,
    addFlow
  }
}
