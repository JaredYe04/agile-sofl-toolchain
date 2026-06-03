import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDocumentStore } from '../src/renderer/stores/document'

describe('document store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('creates initial tab', () => {
    const doc = useDocumentStore()
    doc.ensureInitialTab()
    expect(doc.tabs).toHaveLength(1)
    expect(doc.activeTab).toBeTruthy()
  })

  it('tracks dirty state', () => {
    const doc = useDocumentStore()
    doc.ensureInitialTab()
    const id = doc.activeTab!.id
    doc.updateContent(id, 'module SYSTEM_X;\nend_module\n')
    expect(doc.activeTab!.isDirty).toBe(true)
  })

  it('opens multiple tabs', () => {
    const doc = useDocumentStore()
    doc.openFromFile('/a.asfl', 'content a', 'a.asfl')
    doc.openFromFile('/b.asfl', 'content b', 'b.asfl')
    expect(doc.tabs).toHaveLength(2)
  })
})
