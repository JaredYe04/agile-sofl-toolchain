import { describe, expect, it } from 'vitest'
import { defaultWidgetBounds, resolveNavigateTarget, widgetBounds } from '../src/renderer/lib/guiNavigate'
import type { GuiScreenDto, GuiWidget } from '../src/preload/index'

function widget(partial: Partial<GuiWidget> & Pick<GuiWidget, 'id' | 'kind'>): GuiWidget {
  return partial
}

describe('guiNavigate', () => {
  it('falls back to flow layout when bounds are missing', () => {
    expect(widgetBounds(widget({ id: 'w1', kind: 'button' }), 2)).toEqual(defaultWidgetBounds(2))
  })

  it('resolves navigate events before flows', () => {
    const screens: GuiScreenDto[] = [
      { id: 'home', name: 'Home', widgetCount: 1 },
      { id: 'next', name: 'Next', widgetCount: 0 }
    ]
    const btn = widget({
      id: 'go',
      kind: 'button',
      events: [{ on: 'click', action: 'navigate', targetView: 'next' }]
    })
    expect(resolveNavigateTarget(btn, screens[0]!, screens, [{ from: 'home', to: 'home' }])).toBe('next')
  })
})
