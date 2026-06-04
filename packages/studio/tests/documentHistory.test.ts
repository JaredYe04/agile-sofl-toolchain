import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDocumentHistoryStore } from '../src/renderer/stores/documentHistory'

describe('documentHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
  })

  it('undo/redo restores prior snapshots per tab', () => {
    const h = useDocumentHistoryStore()
    h.initTab('a', 'v0')
    h.pushSnapshot('a', 'v1', true)
    h.pushSnapshot('a', 'v2', true)

    expect(h.undo('a', 'v2')).toBe('v1')
    expect(h.redo('a', 'v1')).toBe('v2')
  })

  it('debounced push merges rapid edits', () => {
    const h = useDocumentHistoryStore()
    h.initTab('b', 'start')
    h.pushSnapshot('b', 'edit1')
    h.pushSnapshot('b', 'edit2')
    vi.advanceTimersByTime(300)
    expect(h.undo('b', 'edit2')).toBe('start')
  })

  it('tabs are isolated', () => {
    const h = useDocumentHistoryStore()
    h.initTab('t1', 'a')
    h.initTab('t2', 'x')
    h.pushSnapshot('t1', 'b', true)
    expect(h.undo('t2', 'x')).toBeNull()
    expect(h.undo('t1', 'b')).toBe('a')
  })

  it('removeTab clears history', () => {
    const h = useDocumentHistoryStore()
    h.initTab('gone', 'z')
    h.pushSnapshot('gone', 'z2', true)
    h.removeTab('gone')
    expect(h.canUndo('gone')).toBe(false)
  })
})
