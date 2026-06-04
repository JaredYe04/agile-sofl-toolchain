import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEditorUiStore } from '../src/renderer/stores/editorUi'

describe('editorUi store', () => {
  beforeEach(() => {
    localStorage.clear()
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

  it('defaults graph nav ratio to 0.5 when sideView is graph', () => {
    localStorage.setItem('studio-visual-side-view', 'graph')
    const ui = useEditorUiStore()
    expect(ui.sideView).toBe('graph')
    expect(ui.visualNavRatio).toBe(0.5)
  })

  it('sets tree ratio when switching to tree without manual resize', () => {
    const ui = useEditorUiStore()
    ui.setSideView('graph')
    expect(ui.visualNavRatio).toBe(0.5)
    ui.setSideView('tree')
    expect(ui.visualNavRatio).toBe(0.22)
  })

  it('persists graph zoom and tool', () => {
    const ui = useEditorUiStore()
    ui.setGraphZoom(75)
    ui.setGraphTool('pan')
    expect(localStorage.getItem('studio-graph-zoom-percent')).toBe('75')
    expect(localStorage.getItem('studio-graph-tool')).toBe('pan')
  })
})
