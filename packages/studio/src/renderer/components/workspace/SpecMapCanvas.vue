<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  layoutSpecMap,
  type SpecMap,
  type SpecMapLayout,
  type SpecMapRef,
  type SpecMapSemanticKind
} from '@agile-sofl/editor-api'
import { useGraphViewport } from '../../composables/useGraphViewport'
import {
  graphExportStyleBlock,
  graphThemeVars
} from '../../lib/graphExportTokens'

const props = defineProps<{
  map: SpecMap
}>()

const emit = defineEmits<{
  select: [ref: SpecMapRef]
}>()

const { t } = useI18n()
const containerRef = ref<HTMLElement | null>(null)
const svgRef = ref<SVGSVGElement | null>(null)
const hoveredId = ref<string | null>(null)
const layout = shallowRef<SpecMapLayout | null>(null)
const exportOpen = ref(false)

const enabled = computed(() => true)
const bbox = computed(() => layout.value?.bbox ?? null)
const {
  cursorClass,
  viewportTransform,
  fitToView,
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp
} = useGraphViewport(containerRef, bbox, enabled)

const KIND_COLOR: Record<SpecMapSemanticKind, string> = {
  frontend: 'var(--map-frontend)',
  backend: 'var(--map-backend)',
  database: 'var(--map-database)',
  process: 'var(--map-process)',
  store: 'var(--map-store)',
  external: 'var(--map-external)',
  security: 'var(--map-failure)',
  start: 'var(--map-start)',
  active: 'var(--map-active)',
  waiting: 'var(--map-waiting)',
  decision: 'var(--map-decision)',
  success: 'var(--map-success)',
  failure: 'var(--map-failure)'
}

watch(
  () => props.map,
  (map) => {
    layout.value = layoutSpecMap(map)
    requestAnimationFrame(() => fitToView())
  },
  { immediate: true, deep: true }
)

function nodeFill(kind: SpecMapSemanticKind): string {
  return KIND_COLOR[kind] ?? 'var(--map-backend)'
}

function onNodeClick(ref: SpecMapRef | undefined): void {
  if (ref) emit('select', ref)
}

function cloneSvgForExport(): SVGSVGElement | null {
  const src = svgRef.value
  const box = layout.value?.bbox
  if (!src || !box) return null
  const clone = src.cloneNode(true) as SVGSVGElement
  const viewportG = clone.querySelector('g[data-viewport]')
  if (viewportG) viewportG.removeAttribute('transform')
  const pad = 16
  const vbX = box.minX - pad
  const vbY = box.minY - pad
  const vbW = box.maxX - box.minX + pad * 2
  const vbH = box.maxY - box.minY + pad * 2
  clone.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`)
  clone.setAttribute('width', String(vbW))
  clone.setAttribute('height', String(vbH))
  const vars = graphThemeVars('current')
  let style = clone.querySelector('style')
  if (!style) {
    style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    clone.insertBefore(style, clone.firstChild)
  }
  style.textContent = graphExportStyleBlock(vars)
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  bg.setAttribute('x', String(vbX))
  bg.setAttribute('y', String(vbY))
  bg.setAttribute('width', String(vbW))
  bg.setAttribute('height', String(vbH))
  bg.setAttribute('fill', vars['--surface-base']?.trim() || '#f3f3f3')
  clone.insertBefore(bg, style.nextSibling)
  return clone
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportSvg(): void {
  const clone = cloneSvgForExport()
  if (!clone) return
  const xml = new XMLSerializer().serializeToString(clone)
  downloadBlob(new Blob([xml], { type: 'image/svg+xml' }), `${props.map.type}.svg`)
  exportOpen.value = false
}

async function exportPng(): Promise<void> {
  const clone = cloneSvgForExport()
  if (!clone) return
  const vars = graphThemeVars('current')
  const xml = new XMLSerializer().serializeToString(clone)
  const img = new Image()
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = reject
    img.src = url
  })
  const w = Number(clone.getAttribute('width') ?? 800)
  const h = Number(clone.getAttribute('height') ?? 600)
  const canvas = document.createElement('canvas')
  canvas.width = w * 2
  canvas.height = h * 2
  const ctx = canvas.getContext('2d')!
  ctx.scale(2, 2)
  ctx.fillStyle = vars['--surface-base']?.trim() || '#f3f3f3'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0)
  URL.revokeObjectURL(url)
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `${props.map.type}.png`)
    exportOpen.value = false
  }, 'image/png')
}

const empty = computed(() => Boolean(props.map.emptyReason) || props.map.nodes.length === 0)
</script>

<template>
  <div
    ref="containerRef"
    class="relative h-full min-h-0 w-full overflow-hidden bg-surface-base"
    :class="cursorClass"
    @wheel.prevent="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
  >
    <div data-graph-ui class="pointer-events-auto absolute left-2 top-2 z-20 flex gap-1">
      <button
        type="button"
        class="rounded-md border border-border-subtle bg-surface-raised/95 px-2 py-1 text-[11px] shadow-sm hover:bg-surface-overlay"
        @click="fitToView"
      >
        {{ t('workspace.specMap.fit') }}
      </button>
      <div class="relative">
        <button
          type="button"
          class="rounded-md border border-border-subtle bg-surface-raised/95 px-2 py-1 text-[11px] shadow-sm hover:bg-surface-overlay"
          @click="exportOpen = !exportOpen"
        >
          {{ t('workspace.specMap.export') }}
        </button>
        <div
          v-if="exportOpen"
          class="absolute left-0 top-full z-30 mt-1 min-w-[140px] rounded-md border border-border-subtle bg-surface-raised py-1 shadow-lg"
        >
          <button type="button" class="block w-full px-3 py-1 text-left text-[11px] hover:bg-surface-overlay" @click="exportSvg">
            {{ t('workspace.specMap.exportSvg') }}
          </button>
          <button type="button" class="block w-full px-3 py-1 text-left text-[11px] hover:bg-surface-overlay" @click="exportPng">
            {{ t('workspace.specMap.exportPng') }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="empty"
      class="absolute inset-0 z-10 flex items-center justify-center px-4 text-center text-[12px] text-content-muted"
    >
      {{ t(`workspace.specMap.empty.${map.emptyReason ?? 'no-specification'}`) }}
    </div>

    <svg
      v-else
      ref="svgRef"
      class="h-full w-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g data-viewport :transform="viewportTransform">
        <rect
          v-for="lane in layout?.lanes ?? []"
          :key="lane.id"
          :x="lane.x"
          :y="lane.y"
          :width="lane.width"
          :height="lane.height"
          rx="8"
          class="fill-surface-overlay/60 stroke-border-subtle"
          stroke-width="1"
        />
        <text
          v-for="lane in layout?.lanes ?? []"
          :key="`${lane.id}-label`"
          :x="lane.x + 8"
          :y="lane.y + 16"
          class="fill-content-muted"
          font-size="10"
        >
          {{ lane.label }}
        </text>
        <line
          v-for="(line, i) in layout?.lifelines ?? []"
          :key="`life-${i}`"
          :x1="line.x"
          :y1="line.y1"
          :x2="line.x"
          :y2="line.y2"
          class="stroke-border-subtle"
          stroke-dasharray="3 4"
        />
        <g v-for="edge in layout?.edges ?? []" :key="edge.id">
          <line
            :x1="edge.x1"
            :y1="edge.y1"
            :x2="edge.x2"
            :y2="edge.y2"
            class="stroke-content-muted"
            stroke-width="1.4"
            marker-end="url(#spec-map-arrow)"
          />
          <text
            v-if="edge.label"
            :x="(edge.x1 + edge.x2) / 2"
            :y="(edge.y1 + edge.y2) / 2 - 4"
            class="fill-content-secondary"
            font-size="9"
            text-anchor="middle"
          >
            {{ edge.label }}
          </text>
        </g>
        <g
          v-for="node in layout?.nodes ?? []"
          :key="node.id"
          data-graph-node
          class="cursor-pointer"
          @click.stop="onNodeClick(node.specRef)"
          @pointerenter="hoveredId = node.id"
          @pointerleave="hoveredId = null"
        >
          <rect
            :x="node.x"
            :y="node.y"
            :width="node.width"
            :height="node.height"
            rx="8"
            :fill="nodeFill(node.kind)"
            :opacity="hoveredId && hoveredId !== node.id ? 0.55 : 0.92"
            class="stroke-surface-raised"
            stroke-width="1"
          />
          <text
            :x="node.x + node.width / 2"
            :y="node.y + node.height / 2 + 4"
            text-anchor="middle"
            font-size="11"
            fill="#fff"
          >
            {{ node.label }}
          </text>
        </g>
      </g>
      <defs>
        <marker id="spec-map-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" class="fill-content-muted" />
        </marker>
      </defs>
    </svg>

    <p
      v-if="!empty && map.truncatedCount"
      class="pointer-events-none absolute bottom-2 left-2 right-2 text-center text-[10px] text-content-muted"
    >
      {{ t('workspace.specMap.truncated', { count: map.truncatedCount }) }}
    </p>
  </div>
</template>
