import { defineStore } from 'pinia'
import { ref } from 'vue'

type TabHistory = {
  undoStack: string[]
  redoStack: string[]
  lastSnapshot: string
  mergeTimer: ReturnType<typeof setTimeout> | null
  lastCoalesceKey: string | null
  lastCoalesceAt: number
}

const MAX_STACK = 100

export const useDocumentHistoryStore = defineStore('documentHistory', () => {
  const histories = ref(new Map<string, TabHistory>())

  function getOrCreate(tabId: string, initialContent: string): TabHistory {
    let h = histories.value.get(tabId)
    if (!h) {
      h = { undoStack: [], redoStack: [], lastSnapshot: initialContent, mergeTimer: null, lastCoalesceKey: null, lastCoalesceAt: 0 }
      histories.value.set(tabId, h)
    }
    return h
  }

  function initTab(tabId: string, content: string): void {
    histories.value.set(tabId, {
      undoStack: [],
      redoStack: [],
      lastSnapshot: content,
      mergeTimer: null,
      lastCoalesceKey: null,
      lastCoalesceAt: 0
    })
  }

  function removeTab(tabId: string): void {
    const h = histories.value.get(tabId)
    if (h?.mergeTimer) clearTimeout(h.mergeTimer)
    histories.value.delete(tabId)
  }

  function pushSnapshot(
    tabId: string,
    content: string,
    immediate = false,
    coalesceKey?: string
  ): void {
    const h = getOrCreate(tabId, content)
    if (content === h.lastSnapshot) return

    const push = () => {
      if (h.mergeTimer) {
        clearTimeout(h.mergeTimer)
        h.mergeTimer = null
      }
      const now = Date.now()
      const coalesce =
        coalesceKey &&
        h.lastCoalesceKey === coalesceKey &&
        now - h.lastCoalesceAt < 2000
      if (!coalesce) {
        h.undoStack.push(h.lastSnapshot)
        if (h.undoStack.length > MAX_STACK) h.undoStack.shift()
        h.redoStack = []
      }
      h.lastCoalesceKey = coalesceKey ?? null
      h.lastCoalesceAt = now
      h.lastSnapshot = content
    }

    if (immediate) {
      push()
      return
    }

    if (h.mergeTimer) clearTimeout(h.mergeTimer)
    h.mergeTimer = setTimeout(() => {
      h.mergeTimer = null
      if (content !== h.lastSnapshot) push()
    }, 300)
  }

  function flushPending(tabId: string, content: string): void {
    const h = histories.value.get(tabId)
    if (!h) return
    if (h.mergeTimer) {
      clearTimeout(h.mergeTimer)
      h.mergeTimer = null
      if (content !== h.lastSnapshot) {
        h.undoStack.push(h.lastSnapshot)
        h.redoStack = []
        h.lastSnapshot = content
      }
    }
  }

  function canUndo(tabId: string): boolean {
    const h = histories.value.get(tabId)
    return Boolean(h && h.undoStack.length > 0)
  }

  function canRedo(tabId: string): boolean {
    const h = histories.value.get(tabId)
    return Boolean(h && h.redoStack.length > 0)
  }

  function undo(tabId: string, currentContent: string): string | null {
    flushPending(tabId, currentContent)
    const h = histories.value.get(tabId)
    if (!h || h.undoStack.length === 0) return null
    h.redoStack.push(currentContent)
    const prev = h.undoStack.pop()!
    h.lastSnapshot = prev
    return prev
  }

  function redo(tabId: string, currentContent: string): string | null {
    const h = histories.value.get(tabId)
    if (!h || h.redoStack.length === 0) return null
    h.undoStack.push(currentContent)
    const next = h.redoStack.pop()!
    h.lastSnapshot = next
    return next
  }

  function applyExternalContent(tabId: string, content: string): void {
    const h = getOrCreate(tabId, content)
    if (h.mergeTimer) {
      clearTimeout(h.mergeTimer)
      h.mergeTimer = null
    }
    h.lastSnapshot = content
  }

  return {
    initTab,
    removeTab,
    pushSnapshot,
    flushPending,
    canUndo,
    canRedo,
    undo,
    redo,
    applyExternalContent
  }
})
