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
      toString: () => 'selected text',
      anchorNode
    } as Selection)

    expect(shouldUseNativeClipboard()).toBe(true)
  })

  it('returns false when there is no selection text', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => '',
      anchorNode: null
    } as Selection)

    expect(shouldUseNativeClipboard()).toBe(false)
  })
})
