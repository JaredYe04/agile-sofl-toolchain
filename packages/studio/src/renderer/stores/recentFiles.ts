import { defineStore } from 'pinia'
import { ref } from 'vue'
import { filePathsEqual } from './tabUtils'

export interface RecentFile {
  path: string
  title: string
  openedAt: number
}

const STORAGE_KEY = 'studio-recent-files'
const MAX_RECENT = 10

function loadRecent(): RecentFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as RecentFile[]
  } catch {
    return []
  }
}

export const useRecentFilesStore = defineStore('recentFiles', () => {
  const items = ref<RecentFile[]>(loadRecent())

  function persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
  }

  function add(path: string, title: string): void {
    items.value = [
      { path, title, openedAt: Date.now() },
      ...items.value.filter((f) => !filePathsEqual(f.path, path))
    ].slice(0, MAX_RECENT)
    persist()
  }

  function remove(path: string): void {
    items.value = items.value.filter((f) => !filePathsEqual(f.path, path))
    persist()
  }

  return { items, add, remove }
})
