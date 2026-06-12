import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type ViewMode = 'code' | 'visual' | 'split'
export type VisualSideView = 'tree' | 'graph'
const VIEW_KEY = 'studio-view-mode'
const GRAPH_ZOOM_KEY = 'studio-graph-zoom-percent'
const MINIMAP_KEY = 'studio-show-minimap'
const LINENUMBERS_KEY = 'studio-show-linenumbers'
const SPLIT_KEY = 'studio-split-ratio'
const SIDE_VIEW_KEY = 'studio-visual-side-view'
const VISUAL_NAV_RATIO_KEY = 'studio-visual-nav-ratio'
const VISUAL_NAV_MANUAL_KEY = 'studio-visual-nav-manual'

const TREE_DEFAULT_RATIO = 0.22
const GRAPH_DEFAULT_RATIO = 0.5

function readBool(key: string, fallback: boolean): boolean {
  const v = localStorage.getItem(key)
  if (v === null) return fallback
  return v === 'true'
}

export const useEditorUiStore = defineStore('editorUi', () => {
  const viewMode = ref<ViewMode>((localStorage.getItem(VIEW_KEY) as ViewMode | null) ?? 'split')
  const showMinimap = ref(readBool(MINIMAP_KEY, true))
  const showLineNumbers = ref(readBool(LINENUMBERS_KEY, true))
  const splitRatio = ref(Number.parseFloat(localStorage.getItem(SPLIT_KEY) ?? '0.5') || 0.5)

  const sideView = ref<VisualSideView>(
    (localStorage.getItem(SIDE_VIEW_KEY) as VisualSideView | null) ?? 'tree'
  )
  const visualNavRatioManual = ref(readBool(VISUAL_NAV_MANUAL_KEY, false))
  const visualNavRatio = ref(
    Number.parseFloat(localStorage.getItem(VISUAL_NAV_RATIO_KEY) ?? String(TREE_DEFAULT_RATIO)) ||
      TREE_DEFAULT_RATIO
  )

  const graphZoomPercent = ref(
    Number.parseInt(localStorage.getItem(GRAPH_ZOOM_KEY) ?? '100', 10) || 100
  )
  let graphFitHandler: (() => void) | null = null

  function setViewMode(mode: ViewMode): void {
    viewMode.value = mode
    localStorage.setItem(VIEW_KEY, mode)
  }

  function setShowMinimap(v: boolean): void {
    showMinimap.value = v
    localStorage.setItem(MINIMAP_KEY, String(v))
  }

  function setShowLineNumbers(v: boolean): void {
    showLineNumbers.value = v
    localStorage.setItem(LINENUMBERS_KEY, String(v))
  }

  function setSplitRatio(r: number): void {
    splitRatio.value = Math.min(0.8, Math.max(0.2, r))
    localStorage.setItem(SPLIT_KEY, String(splitRatio.value))
  }

  function defaultNavRatioFor(mode: VisualSideView): number {
    return mode === 'graph' ? GRAPH_DEFAULT_RATIO : TREE_DEFAULT_RATIO
  }

  function setSideView(mode: VisualSideView): void {
    sideView.value = mode
    localStorage.setItem(SIDE_VIEW_KEY, mode)
    if (!visualNavRatioManual.value) {
      visualNavRatio.value = defaultNavRatioFor(mode)
      localStorage.setItem(VISUAL_NAV_RATIO_KEY, String(visualNavRatio.value))
    }
  }

  function setVisualNavRatio(r: number): void {
    visualNavRatio.value = Math.min(0.75, Math.max(0.15, r))
    visualNavRatioManual.value = true
    localStorage.setItem(VISUAL_NAV_RATIO_KEY, String(visualNavRatio.value))
    localStorage.setItem(VISUAL_NAV_MANUAL_KEY, 'true')
  }

  function showMonaco(): boolean {
    return viewMode.value === 'code' || viewMode.value === 'split'
  }

  function showVisual(): boolean {
    return viewMode.value === 'visual' || viewMode.value === 'split'
  }

  function setGraphZoom(pct: number): void {
    graphZoomPercent.value = Math.min(200, Math.max(25, pct))
    localStorage.setItem(GRAPH_ZOOM_KEY, String(graphZoomPercent.value))
  }

  function registerGraphFit(fn: () => void): void {
    graphFitHandler = fn
  }

  function fitGraphToView(): void {
    graphFitHandler?.()
  }

  function resetGraphView(): void {
    setGraphZoom(100)
    fitGraphToView()
  }

  if (!visualNavRatioManual.value) {
    visualNavRatio.value = defaultNavRatioFor(sideView.value)
  }

  watch(sideView, (mode) => {
    if (!visualNavRatioManual.value) {
      visualNavRatio.value = defaultNavRatioFor(mode)
      localStorage.setItem(VISUAL_NAV_RATIO_KEY, String(visualNavRatio.value))
    }
  })

  return {
    viewMode,
    showMinimap,
    showLineNumbers,
    splitRatio,
    sideView,
    visualNavRatio,
    visualNavRatioManual,
    setViewMode,
    setShowMinimap,
    setShowLineNumbers,
    setSplitRatio,
    setSideView,
    setVisualNavRatio,
    showMonaco,
    showVisual,
    graphZoomPercent,
    setGraphZoom,
    registerGraphFit,
    fitGraphToView,
    resetGraphView
  }
})
