import { describe, expect, it, vi, beforeAll } from 'vitest'
import { shouldUseNativeClipboard } from '../src/renderer/composables/editCommands'

beforeAll(() => {
  vi.stubGlobal('document', {
    activeElement: null
  })
  vi.stubGlobal('window', {
    getSelection: () => null
  })
})

describe('shouldUseNativeClipboard', () => {
  it('returns true when selection anchor is inside visual-panel', () => {
    const parentElement = {
      closest(sel: string) {
        return sel.includes('visual-panel') ? parentElement : null
      }
    }
    const anchorNode = { parentElement }

    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      anchorNode,
      focusNode: anchorNode
    } as Selection)

    expect(shouldUseNativeClipboard()).toBe(true)
  })

  it('returns false when there is no selection text', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 0,
      isCollapsed: true,
      anchorNode: null,
      focusNode: null
    } as Selection)

    expect(shouldUseNativeClipboard()).toBe(false)
  })

  it('returns true when selection is inside agent-bubble', () => {
    const bubble = {
      closest(sel: string) {
        return sel.includes('agent-bubble') ? bubble : null
      }
    }
    const anchorNode = { parentElement: bubble }

    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      anchorNode,
      focusNode: anchorNode
    } as Selection)

    expect(shouldUseNativeClipboard()).toBe(true)
  })
})
