import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useHistoryStore } from '../src/renderer/stores/history'
import { useDocumentStore } from '../src/renderer/stores/document'
import { HistoryKinds, registerHistoryKind, getHistoryKind } from '../src/renderer/history/kinds'

describe('studio history', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('undo/redo restores content across documents on one stack', async () => {
    const doc = useDocumentStore()
    const a = doc.newTab({ content: 'A0', title: 'a.asfl' })
    const b = doc.newTab({ content: 'B0', title: 'b.aspec' })
    const h = useHistoryStore()

    h.applyDocument(a.id, 'A1', { kind: HistoryKinds.hybridEdit, immediate: true })
    h.applyDocument(b.id, 'B1', { kind: HistoryKinds.informalEdit, immediate: true })

    expect(doc.tabs.find((t) => t.id === a.id)?.content).toBe('A1')
    expect(doc.tabs.find((t) => t.id === b.id)?.content).toBe('B1')

    await h.undo()
    expect(doc.tabs.find((t) => t.id === b.id)?.content).toBe('B0')
    expect(doc.tabs.find((t) => t.id === a.id)?.content).toBe('A1')

    await h.undo()
    expect(doc.tabs.find((t) => t.id === a.id)?.content).toBe('A0')

    await h.redo()
    expect(doc.tabs.find((t) => t.id === a.id)?.content).toBe('A1')
  })

  it('debounced typing merges into one undo step', async () => {
    const doc = useDocumentStore()
    const tab = doc.newTab({ content: 'start' })
    const h = useHistoryStore()

    h.applyDocument(tab.id, 'edit1', { kind: HistoryKinds.informalEdit })
    h.applyDocument(tab.id, 'edit2', { kind: HistoryKinds.informalEdit })
    vi.advanceTimersByTime(300)

    expect(h.undoStack.length).toBe(1)
    await h.undo()
    expect(doc.tabs.find((t) => t.id === tab.id)?.content).toBe('start')
  })

  it('coalesceKey merges immediate visual patches', async () => {
    const doc = useDocumentStore()
    const tab = doc.newTab({ content: 'v0' })
    const h = useHistoryStore()

    h.applyDocument(tab.id, 'v1', {
      kind: HistoryKinds.visualPatch,
      coalesceKey: 'decl:A:const:x',
      immediate: true
    })
    h.applyDocument(tab.id, 'v2', {
      kind: HistoryKinds.visualPatch,
      coalesceKey: 'decl:A:const:x',
      immediate: true
    })

    expect(h.undoStack.length).toBe(1)
    await h.undo()
    expect(doc.tabs.find((t) => t.id === tab.id)?.content).toBe('v0')
  })

  it('registers module delete as a distinct kind', async () => {
    const doc = useDocumentStore()
    const tab = doc.newTab({ content: 'module A; end_module' })
    const h = useHistoryStore()

    h.applyDocument(tab.id, '', {
      kind: HistoryKinds.moduleDelete,
      immediate: true,
      labelParams: { name: 'A' }
    })

    expect(h.undoCommand?.kind).toBe(HistoryKinds.moduleDelete)
    await h.undo()
    expect(doc.tabs.find((t) => t.id === tab.id)?.content).toBe('module A; end_module')
  })

  it('clear empties the global stack', () => {
    const doc = useDocumentStore()
    const tab = doc.newTab({ content: 'z' })
    const h = useHistoryStore()
    h.applyDocument(tab.id, 'z2', { immediate: true })
    h.clear()
    expect(h.canUndo).toBe(false)
  })

  it('registerHistoryKind adds a custom command kind', () => {
    registerHistoryKind({ id: 'research-op', labelKey: 'history.kind.documentEdit' })
    expect(getHistoryKind('research-op')?.id).toBe('research-op')
  })
})
