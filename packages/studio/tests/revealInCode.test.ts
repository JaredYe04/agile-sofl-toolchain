import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEditorUiStore } from '../src/renderer/stores/editorUi'
import { useWorkspaceStore } from '../src/renderer/stores/workspace'
import { revealInCodeEditor } from '../src/renderer/composables/useRevealCode'

describe('revealInCodeEditor', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('leaves visual-only mode and opens hybrid code before revealing', async () => {
    const ui = useEditorUiStore()
    const workspace = useWorkspaceStore()
    ui.setViewMode('visual')
    workspace.hybridMode = 'visual'
    const revealed: Array<{ start: number }> = []
    await revealInCodeEditor(
      {
        revealSpan: (span) => {
          revealed.push(span)
        },
        relayout: () => undefined
      },
      { start: 10, end: 12, line: 4, column: 1 },
      { hybrid: true }
    )
    expect(ui.viewMode).toBe('split')
    expect(workspace.hybridMode).toBe('code')
    expect(revealed).toEqual([{ start: 10, end: 12, line: 4, column: 1 }])
  })

  it('opens the GUI code tab', async () => {
    const workspace = useWorkspaceStore()
    workspace.guiMode = 'visual'
    await revealInCodeEditor(null, { start: 0, end: 1, line: 1, column: 1 }, { gui: true })
    expect(workspace.guiMode).toBe('code')
  })
})
