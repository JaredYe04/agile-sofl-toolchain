<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { splitPaneFlex, splitRatioFromDelta } from '../../lib/resizeSplit'

const props = withDefaults(
  defineProps<{
    ratio: number
    minTop?: number
    minBottom?: number
  }>(),
  { minTop: 0.25, minBottom: 0.2 }
)

const emit = defineEmits<{ 'update:ratio': [value: number] }>()
const container = ref<HTMLElement | null>(null)

type DragState = {
  pointerId: number
  startPos: number
  startRatio: number
  available: number
}

const drag = ref<DragState | null>(null)

function onPointerDown(e: PointerEvent): void {
  if (e.button !== 0 || !container.value) return
  e.preventDefault()
  const rect = container.value.getBoundingClientRect()
  const gutter = (e.currentTarget as HTMLElement).getBoundingClientRect()
  drag.value = {
    pointerId: e.pointerId,
    startPos: e.clientY,
    startRatio: props.ratio,
    available: Math.max(0, rect.height - gutter.height)
  }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'
}

function onPointerMove(e: PointerEvent): void {
  const d = drag.value
  if (!d || e.pointerId !== d.pointerId) return
  emit(
    'update:ratio',
    splitRatioFromDelta({
      startRatio: d.startRatio,
      startPos: d.startPos,
      pos: e.clientY,
      available: d.available,
      minFirst: props.minTop,
      minSecond: props.minBottom
    })
  )
}

function endDrag(e: PointerEvent): void {
  const d = drag.value
  if (!d || e.pointerId !== d.pointerId) return
  const target = e.currentTarget as HTMLElement
  if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId)
  drag.value = null
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

onUnmounted(() => {
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
})
</script>

<template>
  <div ref="container" class="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
    <div class="min-h-0 min-w-0 overflow-hidden" :style="{ flex: splitPaneFlex(ratio) }">
      <slot name="top" />
    </div>
    <div
      class="group/resize relative z-20 h-3 w-full shrink-0 cursor-row-resize touch-none"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="endDrag"
      @pointercancel="endDrag"
    >
      <div
        class="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-border-subtle transition-colors duration-150 group-hover/resize:bg-accent/40"
        :class="{ 'bg-accent/40': Boolean(drag) }"
      />
    </div>
    <div class="min-h-0 min-w-0 overflow-hidden" :style="{ flex: splitPaneFlex(1 - ratio) }">
      <slot name="bottom" />
    </div>
  </div>
</template>
