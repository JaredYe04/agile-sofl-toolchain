import { defineStore } from 'pinia'
import { ref } from 'vue'
import { startLanguageClient } from '../monaco/languageClient'

export const useLspStore = defineStore('lsp', () => {
  const running = ref(false)
  const errorCount = ref(0)
  const message = ref('')
  let clientStarted = false
  let unsubStatus: (() => void) | undefined

  async function refresh(): Promise<void> {
    const status = await window.studio?.getLspStatus()
    if (status) {
      running.value = status.running
      message.value = status.message
    }
  }

  async function ensureClient(): Promise<void> {
    if (clientStarted || !running.value) return
    await startLanguageClient()
    clientStarted = true
  }

  function init(): void {
    refresh()
    unsubStatus = window.studio?.lspOnStatusChanged(async (s) => {
      running.value = s.running
      if (s.message) message.value = s.message
      if (s.running) {
        if (!s.message) message.value = 'Language server connected'
        await ensureClient()
      } else {
        if (!s.message) message.value = 'Language server disconnected'
        clientStarted = false
      }
    })
    if (running.value) void ensureClient()
  }

  function dispose(): void {
    unsubStatus?.()
  }

  function setErrorCount(count: number): void {
    errorCount.value = count
  }

  return { running, errorCount, message, refresh, init, dispose, setErrorCount, ensureClient }
})
