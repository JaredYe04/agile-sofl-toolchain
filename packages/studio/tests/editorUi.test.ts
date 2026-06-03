import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEditorUiStore } from '../src/renderer/stores/editorUi'

describe('editorUi store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('defaults to split view mode', () => {
    const ui = useEditorUiStore()
    expect(ui.viewMode).toBe('split')
    expect(ui.showMonaco()).toBe(true)
    expect(ui.showVisual()).toBe(true)
  })

  it('switches view modes', () => {
    const ui = useEditorUiStore()
    ui.setViewMode('split')
    expect(ui.showMonaco()).toBe(true)
    expect(ui.showVisual()).toBe(true)
    ui.setViewMode('visual')
    expect(ui.showMonaco()).toBe(false)
    expect(ui.showVisual()).toBe(true)
  })

  it('clamps split ratio', () => {
    const ui = useEditorUiStore()
    ui.setSplitRatio(0.1)
    expect(ui.splitRatio).toBe(0.2)
    ui.setSplitRatio(0.9)
    expect(ui.splitRatio).toBe(0.8)
  })

  it('persists toggles to localStorage', () => {
    const ui = useEditorUiStore()
    ui.setShowMinimap(false)
    ui.setShowLineNumbers(false)
    expect(localStorage.getItem('studio-show-minimap')).toBe('false')
    expect(localStorage.getItem('studio-show-linenumbers')).toBe('false')
  })
})
