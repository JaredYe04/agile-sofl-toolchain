<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CdfdGraph, CdfdLayout } from '../../../lib/editorApiRenderer'
import { layoutCdfdGraphAdaptive } from '../../../lib/cdfdElkLayout'
import { useGraphViewport, type GraphBBox } from '../../../composables/useGraphViewport'

type CdfdLayoutNode = CdfdLayout['nodes'][number]
type CdfdLayoutEdge = CdfdLayout['edges'][number]

let markerSeq = 0

const props = defineProps<{
  graph: CdfdGraph | null
  moduleName?: string
  /** When set, layout runs even if the side-view switcher is not on CDFD. */
  active?: boolean
}>()

const emit = defineEmits<{
  drill: [moduleName: string]
  selectProcess: [processName: string]
}>()

const { t } = useI18n()
const containerRef = ref<HTMLElement | null>(null)
const layout = ref<CdfdLayout | null>(null)
const graphEnabled = computed(() => props.active !== false)
const markerId = `cdfd-arrow-${++markerSeq}`

const bbox = computed<GraphBBox | null>(() => {
  if (!layout.value) return null
  return layout.value.bbox
})

const { viewportTransform, cursorClass, onPointerDown, onPointerMove, onPointerUp, onWheel, fitToView } = useGraphViewport(
  containerRef,
  bbox,
  graphEnabled
)

watch(
  () => [props.graph, graphEnabled.value] as const,
  async ([graph, enabled]) => {
    if (!enabled || !graph || graph.empty) {
      layout.value = null
      return
    }
    layout.value = await layoutCdfdGraphAdaptive(graph as CdfdGraph)
  },
  { immediate: true }
)

watch(layout, () => {
  if (graphEnabled.value) fitToView()
})

const drawnNodes = computed(() => (layout.value?.nodes ?? []).filter((n) => n.kind !== 'port-in' && n.kind !== 'port-out'))

const storeIndex = computed(() => {
  const stores = drawnNodes.value
    .filter((n) => n.kind === 'store')
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
  return new Map(stores.map((n, i) => [n.id, i + 1]))
})

const nodeById = computed(() => new Map((layout.value?.nodes ?? []).map((n) => [n.id, n])))

function onDblClick(node: CdfdLayoutNode): void {
  if (node.composite && node.decomTarget) emit('drill', node.decomTarget)
  else if (node.kind === 'process') emit('selectProcess', node.name)
}

function polyline(points: Array<{ x: number; y: number }>): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ')
}

function diamondPoints(node: CdfdLayoutNode): string {
  const cx = node.x + node.width / 2
  const cy = node.y + node.height / 2
  return `${cx},${node.y} ${node.x + node.width},${cy} ${cx},${node.y + node.height} ${node.x},${cy}`
}

function ink(node: CdfdLayoutNode): string {
  return node.composite ? 'var(--accent)' : 'var(--text-primary)'
}

function isDashed(edge: CdfdLayoutEdge): boolean {
  if (edge.guard || edge.isOthers) return true
  return nodeById.value.get(edge.from)?.kind === 'port-in'
}

function edgeLabel(edge: CdfdLayoutEdge): string {
  if (edge.isOthers) return 'others'
  if (edge.guard) return edge.guard.length > 28 ? `${edge.guard.slice(0, 27)}…` : edge.guard
  const from = nodeById.value.get(edge.from)
  const to = nodeById.value.get(edge.to)
  if (from?.kind === 'port-in') return from.name
  if (to?.kind === 'port-out') return to.name
  return ''
}

function labelAnchor(points: Array<{ x: number; y: number }>): { x: number; y: number } | null {
  if (points.length < 2) return null
  let best = 0
  let bestLen = -1
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1]!.x - points[i]!.x
    const dy = points[i + 1]!.y - points[i]!.y
    const len = dx * dx + dy * dy
    if (len > bestLen) {
      bestLen = len
      best = i
    }
  }
  const a = points[best]!
  const b = points[best + 1]!
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function labelWidth(text: string): number {
  let width = 0
  for (const ch of text) width += ch.charCodeAt(0) > 255 ? 12 : 6.6
  return width + 10
}

const flowLabels = computed(() =>
  (layout.value?.edges ?? []).flatMap((edge) => {
    const text = edgeLabel(edge)
    const at = labelAnchor(edge.points)
    if (!text || !at) return []
    return [{ id: edge.id, text, x: at.x, y: at.y, width: labelWidth(text) }]
  })
)
</script>

<template>
  <div
    ref="containerRef"
    class="relative h-full min-h-0 w-full overflow-hidden bg-surface-base"
    :class="cursorClass"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @wheel.prevent="onWheel"
  >
    <div
      v-if="!graph || graph.empty"
      class="flex h-full items-center justify-center p-6 text-sm text-content-secondary"
    >
      {{ t('visual.cdfdEmpty') }}
    </div>
    <svg
      v-else-if="layout"
      class="h-full w-full"
      :viewBox="`${layout.bbox.minX} ${layout.bbox.minY} ${layout.bbox.maxX - layout.bbox.minX} ${layout.bbox.maxY - layout.bbox.minY}`"
    >
      <defs>
        <marker
          :id="markerId"
          viewBox="0 0 10 8"
          refX="9"
          refY="4"
          markerWidth="9"
          markerHeight="7"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L10,4 L0,8 Z" fill="var(--text-primary)" />
        </marker>
      </defs>
      <g :transform="viewportTransform">
        <polyline
          v-for="edge in layout.edges"
          :key="edge.id"
          fill="none"
          stroke="var(--text-primary)"
          stroke-width="1.25"
          stroke-linejoin="round"
          :stroke-dasharray="isDashed(edge) ? '6 4' : undefined"
          :marker-end="`url(#${markerId})`"
          :points="polyline(edge.points)"
        />
        <g v-for="label in flowLabels" :key="`${label.id}-label`">
          <rect
            :x="label.x - label.width / 2"
            :y="label.y - 16"
            :width="label.width"
            :height="14"
            fill="var(--surface-base)"
          />
          <text
            :x="label.x"
            :y="label.y - 9"
            text-anchor="middle"
            dominant-baseline="middle"
            fill="var(--text-secondary)"
            font-size="11"
            font-family="inherit"
          >
            {{ label.text }}
          </text>
        </g>
        <g
          v-for="node in drawnNodes"
          :key="node.id"
          class="cursor-pointer"
          @dblclick.stop="onDblClick(node)"
        >
          <template v-if="node.kind === 'process'">
            <rect
              :x="node.x"
              :y="node.y"
              :width="node.width"
              :height="node.height"
              fill="var(--surface-raised)"
              :stroke="ink(node)"
              stroke-width="1.35"
            />
            <line
              :x1="node.x"
              :x2="node.x + node.width"
              :y1="node.y + 8"
              :y2="node.y + 8"
              :stroke="ink(node)"
              stroke-width="1.35"
            />
            <text
              :x="node.x + node.width / 2"
              :y="node.y + 8 + (node.height - 8) / 2"
              text-anchor="middle"
              dominant-baseline="middle"
              fill="var(--text-primary)"
              font-size="13"
              font-family="inherit"
            >
              {{ node.name }}
            </text>
          </template>
          <template v-else-if="node.kind === 'store'">
            <rect
              :x="node.x"
              :y="node.y"
              :width="node.width"
              :height="node.height"
              fill="var(--surface-raised)"
              stroke="var(--text-primary)"
              stroke-width="1.35"
            />
            <line
              :x1="node.x + 28"
              :x2="node.x + 28"
              :y1="node.y"
              :y2="node.y + node.height"
              stroke="var(--text-primary)"
              stroke-width="1.35"
            />
            <text
              :x="node.x + 14"
              :y="node.y + node.height / 2"
              text-anchor="middle"
              dominant-baseline="middle"
              fill="var(--text-primary)"
              font-size="12"
              font-family="inherit"
            >
              {{ storeIndex.get(node.id) }}
            </text>
            <text
              :x="node.x + 36"
              :y="node.y + node.height / 2"
              dominant-baseline="middle"
              fill="var(--text-primary)"
              font-size="12"
              font-family="inherit"
            >
              {{ node.name }}
            </text>
          </template>
          <template v-else>
            <polygon
              :points="diamondPoints(node)"
              fill="var(--surface-raised)"
              stroke="var(--text-primary)"
              stroke-width="1.35"
            />
            <text
              :x="node.x + node.width / 2"
              :y="node.y + node.height / 2"
              text-anchor="middle"
              dominant-baseline="middle"
              fill="var(--text-primary)"
              font-size="11"
              font-family="inherit"
            >
              {{ node.name }}
            </text>
          </template>
        </g>
      </g>
    </svg>
  </div>
</template>
