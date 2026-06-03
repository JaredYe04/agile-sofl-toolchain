import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLspStore = defineStore('lsp', () => {
  const running = ref(false)
  const errorCount = ref(0)
  const message = ref('')

  async function refresh(): Promise<void> {
    const status = await window.studio?.getLspStatus()
    if (status) {
      running.value = status.running
      message.value = status.message
    }
  }

  function init(): void {
    refresh()
    window.studio?.lspOnStatusChanged((s) => {
      running.value = s.running
    })
  }

  function setErrorCount(count: number): void {
    errorCount.value = count
  }

  return { running, errorCount, message, refresh, init, setErrorCount }
})
