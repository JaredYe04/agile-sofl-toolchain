<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  buildVerticalTreeLayout,
  type VerticalLayoutNode
} from '../../../lib/refinementVerticalTree'
import { emptyRefinementState, type RefinementStateDto } from '../../../lib/refinementTypes'

const props = defineProps<{
  state: RefinementStateDto | null
}>()

const { t } = useI18n()
const containerRef = ref<HTMLElement | null>(null)
const pan = ref({ x: 16, y: 16 })
const scale = ref(1)
const dragging = ref(false)
const userMoved = ref(false)
let dragStart = { x: 0, y: 0, panX: 0, panY: 0 }

const layout = computed(() => buildVerticalTreeLayout(props.state ?? emptyRefinementState()))

const nodeById = computed(() => {
  const map = new Map<string, VerticalLayoutNode>()
  for (const n of layout.value.nodes) map.set(n.id, n)
  return map
})

function edgePath(from: string, to: string): string {
  const a = nodeById.value.get(from)
  const b = nodeById.value.get(to)
  if (!a || !b) return ''
  const x1 = a.x + a.width / 2
  const y1 = a.y + a.height
  const x2 = b.x + b.width / 2
  const y2 = b.y
  const midY = (y1 + y2) / 2
  return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`
}

function nodeFill(n: VerticalLayoutNode): string {
  if (n.status === 'atomic') return 'color-mix(in srgb, #16a34a 22%, var(--surface-raised))'
  if (n.status === 'ready') return 'color-mix(in srgb, var(--accent) 16%, var(--surface-raised))'
  if (n.kind === 'gap' || n.problem) return 'color-mix(in srgb, var(--semantic-warning) 16%, var(--surface-raised))'
  if (n.kind === 'module') return 'var(--surface-raised)'
  return 'var(--surface-overlay)'
}

function nodeStroke(n: VerticalLayoutNode): string {
  if (n.status === 'atomic') return '#16a34a'
  if (n.status === 'ready') return 'var(--accent)'
  if (n.kind === 'gap' || n.problem) return 'var(--semantic-warning)'
  return 'var(--border-subtle)'
}

function clip(text: string, max = 20): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function statusLabel(n: VerticalLayoutNode): string | null {
  if (n.kind !== 'leaf' || !n.status) return null
  return t(`visual.atomicity.status.${n.status}`)
}

function fit(): void {
  const el = containerRef.value
  const nodes = layout.value.nodes
  if (!el || !nodes.length) return
  const w = el.clientWidth
  const h = el.clientHeight
  if (w < 40 || h < 40) return
  const minX = Math.min(...nodes.map((n) => n.x))
  const minY = Math.min(...nodes.map((n) => n.y))
  const maxX = Math.max(...nodes.map((n) => n.x + n.width))
  const maxY = Math.max(...nodes.map((n) => n.y + n.height))
  const bw = maxX - minX + 48
  const bh = maxY - minY + 48
  const next = Math.min(1.4, Math.max(0.2, Math.min(w / bw, h / bh)))
  scale.value = next
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  pan.value = { x: w / 2 - cx * next, y: h / 2 - cy * next }
}

function onWheel(e: WheelEvent): void {
  if (!(e.ctrlKey || e.metaKey)) return
  e.preventDefault()
  userMoved.value = true
  const el = containerRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
  const next = Math.min(2.5, Math.max(0.2, scale.value * factor))
  const ratio = next / scale.value
  pan.value = {
    x: mx - (mx - pan.value.x) * ratio,
    y: my - (my - pan.value.y) * ratio
  }
  scale.value = next
}

function onPointerDown(e: PointerEvent): void {
  if (e.button !== 0) return
  dragging.value = true
  userMoved.value = true
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
    /* already released */
  }
}

watch(
  layout,
  () => {
    if (!userMoved.value) void nextTick(fit)
  },
  { flush: 'post' }
)

watch(containerRef, (el, prev) => {
  prev?.removeEventListener('wheel', onWheel)
  el?.addEventListener('wheel', onWheel, { passive: false })
  if (el && !userMoved.value) void nextTick(fit)
})

onUnmounted(() => {
  containerRef.value?.removeEventListener('wheel', onWheel)
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col bg-surface-base">
    <div class="flex shrink-0 flex-wrap gap-3 border-b border-border-subtle px-3 py-2 text-[10px] text-content-muted">
      <span class="inline-flex items-center gap-1.5">
        <span class="h-3 w-3 rounded border border-[#16a34a] bg-[#16a34a]/20" />
        {{ t('visual.atomicity.status.atomic') }}
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="h-3 w-3 rounded border border-accent bg-accent/10" />
        {{ t('visual.atomicity.status.ready') }}
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="h-3 w-3 rounded border border-semantic-warning bg-semantic-warning/10" />
        {{ t('visual.atomicity.status.open') }}
      </span>
      <span class="ml-auto">{{ t('visual.refineVertical.navigate') }}</span>
    </div>
    <p v-if="!props.state" class="py-8 text-center text-[12px] text-content-muted">
      {{ t('visual.atomicity.empty') }}
    </p>
    <p v-else-if="!layout.nodes.length" class="py-8 text-center text-[12px] text-content-muted">
      {{ t('visual.refineVertical.empty') }}
    </p>
    <div
      v-else
      ref="containerRef"
      class="relative min-h-0 flex-1 overflow-hidden"
      :class="dragging ? 'cursor-grabbing' : 'cursor-grab'"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <svg
        class="absolute left-0 top-0 overflow-visible"
        :width="layout.width"
        :height="layout.height"
        :style="{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: '0 0'
        }"
        role="img"
        :aria-label="t('visual.refineVertical.aria')"
      >
        <g fill="none" stroke="var(--border-subtle)" stroke-width="1.5">
          <path v-for="(e, i) in layout.edges" :key="`${e.from}-${e.to}-${i}`" :d="edgePath(e.from, e.to)" />
        </g>
        <g v-for="n in layout.nodes" :key="n.id">
          <rect
            :x="n.x"
            :y="n.y"
            :width="n.width"
            :height="n.height"
            rx="6"
            :fill="nodeFill(n)"
            :stroke="nodeStroke(n)"
            stroke-width="1.5"
          />
          <text
            :x="n.x + 10"
            :y="n.y + 18"
            fill="var(--text-primary)"
            font-size="12"
            font-weight="600"
          >
            {{ clip(n.label) }}
            <title>{{ n.label }}</title>
          </text>
          <text :x="n.x + 10" :y="n.y + 34" fill="var(--text-muted)" font-size="10">
            {{ statusLabel(n) ?? n.summary ?? '' }}
          </text>
        </g>
      </svg>
    </div>
  </div>
</template>
