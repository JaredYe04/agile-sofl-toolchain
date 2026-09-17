import type { GuiWidget, GuiScreenDto } from '../../preload/index'

export function defaultWidgetBounds(index: number): { x: number; y: number; width: number; height: number } {
  return { x: 24, y: 24 + index * 48, width: 200, height: 36 }
}

export function widgetBounds(widget: GuiWidget, index: number): { x: number; y: number; width: number; height: number } {
  return widget.bounds ?? defaultWidgetBounds(index)
}

export function resolveNavigateTarget(
  widget: GuiWidget,
  screen: GuiScreenDto | null,
  screens: GuiScreenDto[],
  flows: Array<{ from: string; to: string; on?: string; label?: string }>
): string | null {
  const nav = widget.events?.find((e) => e.action === 'navigate' && e.targetView)
  if (nav?.targetView) {
    const hit = resolveGuiScreenId(screens, nav.targetView)
    if (hit) return hit
  }
  if (widget.action) {
    const byName = resolveGuiScreenId(screens, widget.action)
    if (byName) return byName
  }
  const flow = flows.find(
    (f) =>
      (f.from === screen?.name || f.from === screen?.id) &&
      (f.on === widget.id || f.on === widget.label || f.label === widget.label)
  )
  if (flow) {
    return resolveGuiScreenId(screens, flow.to)
  }
  return null
}

/** Match a data-nav / list click against screen id or name. */
export function resolveGuiScreenId(
  screens: Array<{ id: string; name?: string }>,
  ref?: string | null
): string | null {
  if (!ref?.trim()) return null
  const key = ref.trim()
  const hit = screens.find(
    (s) =>
      s.id === key ||
      s.name === key ||
      s.id.toLowerCase() === key.toLowerCase() ||
      (s.name && s.name.toLowerCase() === key.toLowerCase())
  )
  return hit?.id ?? null
}
