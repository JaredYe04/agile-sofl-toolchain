import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { countBySeverity, type MergedDiagnostic } from '@agile-sofl/editor-api'

export const useDocumentDiagnosticsStore = defineStore('documentDiagnostics', () => {
  const unified = ref<MergedDiagnostic[]>([])

  function setUnified(items: MergedDiagnostic[]): void {
    unified.value = items
  }

  function clear(): void {
    unified.value = []
  }

  const counts = computed(() => countBySeverity(unified.value))

  return { unified, setUnified, clear, counts }
})
