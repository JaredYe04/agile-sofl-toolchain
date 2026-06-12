import { ref, computed, watch, type Ref } from 'vue'
import { useEditorUiStore } from '../stores/editorUi'

export type GraphBBox = { minX: number; minY: number; maxX: number; maxY: number }

export function useGraphViewport(
  containerRef: Ref<HTMLElement | null>,
  bbox: Ref<GraphBBox | null>,
  enabled: Ref<boolean>
) {
  const editorUi = useEditorUiStore()
  const pan = ref({ x: 0, y: 0 })
  const scale = ref(editorUi.graphZoomPercent / 100)
  const dragging = ref(false)
  let dragStart = { x: 0, y: 0, panX: 0, panY: 0 }

  const cursorClass = computed(() => (dragging.value ? 'cursor-grabbing' : 'cursor-grab'))

  const viewportTransform = computed(
    () => `translate(${pan.value.x},${pan.value.y}) scale(${scale.value})`
  )

  function syncZoomPercent(): void {
    const pct = Math.round(scale.value * 100)
    if (editorUi.graphZoomPercent !== pct) editorUi.setGraphZoom(pct)
  }

  function applyZoomPercent(pct: number): void {
    const next = Math.min(200, Math.max(25, pct)) / 100
    scale.value = next
    editorUi.setGraphZoom(Math.round(next * 100))
  }

  function fitToView(): void {
    const el = containerRef.value
    const box = bbox.value
    if (!el || !box) return
    const w = el.clientWidth
    const h = el.clientHeight
    if (w <= 0 || h <= 0) return
    const bw = box.maxX - box.minX + 48
    const bh = box.maxY - box.minY + 40
    const s = Math.min(w / bw, h / bh, 2)
    scale.value = Math.max(0.25, s)
    const cx = (box.minX + box.maxX) / 2
    const cy = (box.minY + box.maxY) / 2
    pan.value = {
      x: w / 2 - cx * scale.value,
      y: h / 2 - cy * scale.value
    }
    syncZoomPercent()
  }

  function isGraphUiTarget(e: Event): boolean {
    return Boolean((e.target as Element | null)?.closest('[data-graph-ui]'))
  }

  function isGraphNodeTarget(e: Event): boolean {
    const el = e.target as Element | null
    return Boolean(el?.closest('[data-graph-node]') || el?.closest('[data-graph-edge]'))
  }

  function isGraphResizeTarget(e: Event): boolean {
    return Boolean((e.target as Element | null)?.closest('[data-graph-resize]'))
  }

  function onWheel(e: WheelEvent): void {
    if (!enabled.value) return
    if (isGraphUiTarget(e)) return
    e.preventDefault()
    const el = containerRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
      const next = Math.min(2, Math.max(0.25, scale.value * factor))
      const ratio = next / scale.value
      pan.value = {
        x: mx - (mx - pan.value.x) * ratio,
        y: my - (my - pan.value.y) * ratio
      }
      scale.value = next
      syncZoomPercent()
    } else {
      pan.value = {
        x: pan.value.x,
        y: pan.value.y - e.deltaY
      }
    }
  }

  function onPointerDown(e: PointerEvent): void {
    if (!enabled.value) return
    if (isGraphUiTarget(e)) return
    if (isGraphResizeTarget(e)) return
    if (isGraphNodeTarget(e)) return
    if (e.button !== 0) return
    dragging.value = true
    dragStart = { x: e.clientX, y: e.clientY, panX: pan.value.x, panY: pan.value.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging.value) return
    pan.value = {
      x: dragStart.panX + (e.clientX - dragStart.x),
      y: dragStart.panY + (e.clientY - dragStart.y)
    }
  }

  function onPointerUp(e: PointerEvent): void {
    if (!dragging.value) return
    dragging.value = false
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  watch(
    () => editorUi.graphZoomPercent,
    (pct) => {
      const target = pct / 100
      if (Math.abs(target - scale.value) > 0.001) scale.value = target
    }
  )

  watch(enabled, (on) => {
    if (on) fitToView()
  })

  editorUi.registerGraphFit(fitToView)

  return {
    pan,
    scale,
    cursorClass,
    viewportTransform,
    fitToView,
    applyZoomPercent,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp
  }
}
