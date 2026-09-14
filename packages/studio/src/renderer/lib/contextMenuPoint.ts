/** Root UI zoom (`html { zoom }`) — fixed menus must use layout coords, not raw clientX/Y. */
export function readUiZoomFactor(root: HTMLElement = document.documentElement): number {
  const fromZoom = Number.parseFloat(getComputedStyle(root).zoom || '')
  if (Number.isFinite(fromZoom) && fromZoom > 0) return fromZoom
  const fromVar = Number.parseFloat(getComputedStyle(root).getPropertyValue('--ui-zoom') || '1')
  return Number.isFinite(fromVar) && fromVar > 0 ? fromVar : 1
}

/** Viewport point for `position: fixed` popovers teleported to `body`. */
export function contextMenuPoint(event: MouseEvent): { x: number; y: number } {
  const zoom = readUiZoomFactor()
  return { x: event.clientX / zoom, y: event.clientY / zoom }
}
