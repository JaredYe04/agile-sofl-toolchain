import { ref, watch, computed, type Ref } from 'vue'
import { useDocumentStore } from '../stores/document'

export type ProcessInformalHint = {
  bottomLevel: boolean
  expectedFsfLevel: 'semi-formal' | 'formal'
}

export function useLinkedInformalHints(activeTabId: Ref<string | undefined>) {
  const doc = useDocumentStore()
  const hintsByProcess = ref<Map<string, ProcessInformalHint>>(new Map())

  const linkedAspecTab = computed(() => {
    const tab = doc.tabs.find((t) => t.id === activeTabId.value && t.documentKind === 'asfl')
    if (!tab?.linkedDocumentId) return undefined
    return doc.tabs.find((t) => t.id === tab.linkedDocumentId && t.documentKind === 'aspec')
  })

  async function refresh(): Promise<void> {
    const aspec = linkedAspecTab.value
    if (!aspec?.content || !window.studio?.buildInformalModel) {
      hintsByProcess.value = new Map()
      return
    }
    const model = await window.studio.buildInformalModel(aspec.content)
    const map = new Map<string, ProcessInformalHint>()
    for (const mod of model.modules) {
      for (const proc of mod.processes ?? []) {
        const bottom = proc.refinementHints?.bottomLevel ?? false
        map.set(proc.name, {
          bottomLevel: bottom,
          expectedFsfLevel: proc.refinementHints?.expectedFsfLevel ?? (bottom ? 'formal' : 'semi-formal')
        })
      }
    }
    hintsByProcess.value = map
  }

  watch([linkedAspecTab, () => linkedAspecTab.value?.content], () => void refresh(), { immediate: true })

  function hintForProcess(processName: string): ProcessInformalHint | undefined {
    return hintsByProcess.value.get(processName)
  }

  function blockInformalForProcess(processName: string, hasDecom: boolean, fsfStrict: boolean): boolean {
    const hint = hintForProcess(processName)
    if (hint?.bottomLevel) return true
    if (!hasDecom) return true
    if (fsfStrict && (hint?.expectedFsfLevel === 'formal' || hint?.bottomLevel)) return true
    return false
  }

  function shouldBlockInformalForProcess(processName: string, hasDecom: boolean): boolean {
    return blockInformalForProcess(processName, hasDecom, false)
  }

  return { hintsByProcess, hintForProcess, blockInformalForProcess, shouldBlockInformalForProcess, refresh }
}
