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
    const hit = screens.find((s) => s.id === nav.targetView || s.name === nav.targetView)
    if (hit) return hit.id
  }
  if (widget.action) {
    const byName = screens.find((s) => s.name === widget.action || s.id === widget.action)
    if (byName) return byName.id
  }
  const flow = flows.find(
    (f) =>
      (f.from === screen?.name || f.from === screen?.id) &&
      (f.on === widget.id || f.on === widget.label || f.label === widget.label)
  )
  if (flow) {
    const target = screens.find((s) => s.name === flow.to || s.id === flow.to)
    return target?.id ?? null
  }
  return null
}
