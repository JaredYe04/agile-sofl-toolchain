import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { DiagnosticSummary } from '../../preload/index'

export const useLspDiagnosticsStore = defineStore('lspDiagnostics', () => {
  const markers = ref<DiagnosticSummary[]>([])

  function setMarkers(items: DiagnosticSummary[]): void {
    markers.value = items
  }

  function clear(): void {
    markers.value = []
  }

  return { markers, setMarkers, clear }
})
