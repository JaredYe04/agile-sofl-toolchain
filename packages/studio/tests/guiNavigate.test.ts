import { describe, expect, it } from 'vitest'
import { defaultWidgetBounds, resolveGuiScreenId, resolveNavigateTarget, widgetBounds } from '../src/renderer/lib/guiNavigate'
import { fullPathToScreenTree, prototypePathToFull, screenTreePathToFull } from '../src/renderer/lib/guiPrototype'
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

  it('resolves data-nav screen names to canonical ids', () => {
    const screens: GuiScreenDto[] = [
      { id: 'view-home', name: 'Home', widgetCount: 1 },
      { id: 'view-next', name: 'Next', widgetCount: 0 }
    ]
    expect(resolveGuiScreenId(screens, 'Next')).toBe('view-next')
    expect(resolveGuiScreenId(screens, 'view-home')).toBe('view-home')
    const btn = widget({
      id: 'go',
      kind: 'button',
      events: [{ on: 'click', action: 'navigate', targetView: 'Next' }]
    })
    expect(resolveNavigateTarget(btn, screens[0]!, screens, [])).toBe('view-next')
  })
})

describe('single-screen prototype paths', () => {
  it('maps the second screen prototype hits onto the full document', () => {
    expect(prototypePathToFull('0.0', '0.1')).toBe('0.1')
    expect(prototypePathToFull('0.0.2', '0.1')).toBe('0.1.2')
    expect(screenTreePathToFull('0.2', '0.1')).toBe('0.1.2')
    expect(fullPathToScreenTree('0.1.2', '0.1')).toBe('0.2')
  })
})
