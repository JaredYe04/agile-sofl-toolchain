import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'studio-project-root'

export const useProjectStore = defineStore('project', () => {
  const root = ref<string | null>(localStorage.getItem(STORAGE_KEY))
  const opening = ref(false)
  const scanning = ref(false)

  function setRoot(path: string | null): void {
    root.value = path
    if (path) localStorage.setItem(STORAGE_KEY, path)
    else localStorage.removeItem(STORAGE_KEY)
  }

  async function openFolder(): Promise<string | null> {
    if (opening.value) return null
    opening.value = true
    try {
      const path = await window.studio?.openProjectFolder?.()
      if (path) setRoot(path)
      return path ?? null
    } finally {
      opening.value = false
    }
  }

  function setScanning(v: boolean): void {
    scanning.value = v
  }

  return { root, opening, scanning, setRoot, openFolder, setScanning }
})
