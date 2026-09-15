<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { splitPaneFlex, splitRatioFromDelta } from '../../lib/resizeSplit'

const props = withDefaults(
  defineProps<{
    direction: 'horizontal' | 'vertical'
    ratio: number
    minFirst?: number
    minSecond?: number
  }>(),
  { minFirst: 0.15, minSecond: 0.15 }
)

const emit = defineEmits<{ 'update:ratio': [value: number] }>()
const container = ref<HTMLElement | null>(null)
const isVertical = computed(() => props.direction === 'vertical')

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
  const available = Math.max(
    0,
    isVertical.value ? rect.height - gutter.height : rect.width - gutter.width
  )
  drag.value = {
    pointerId: e.pointerId,
    startPos: isVertical.value ? e.clientY : e.clientX,
    startRatio: props.ratio,
    available
  }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  document.body.style.cursor = isVertical.value ? 'row-resize' : 'col-resize'
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
      pos: isVertical.value ? e.clientY : e.clientX,
      available: d.available,
      minFirst: props.minFirst,
      minSecond: props.minSecond
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
  <div
    ref="container"
    class="flex h-full min-h-0 w-full min-w-0 flex-1"
    :class="isVertical ? 'flex-col' : 'flex-row'"
  >
    <div
      class="min-h-0 min-w-0 overflow-hidden"
      :style="{ flex: splitPaneFlex(ratio) }"
    >
      <slot name="first" />
    </div>
    <div
      class="group/resize relative z-20 shrink-0 touch-none bg-transparent"
      :class="
        isVertical
          ? 'h-3 w-full cursor-row-resize'
          : 'h-full w-3 cursor-col-resize'
      "
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="endDrag"
      @pointercancel="endDrag"
    >
      <div
        class="pointer-events-none absolute bg-border-subtle transition-colors duration-150 group-hover/resize:bg-accent/40"
        :class="[
          isVertical
            ? 'inset-x-0 top-1/2 h-1 -translate-y-1/2'
            : 'inset-y-0 left-1/2 w-1 -translate-x-1/2',
          drag ? 'bg-accent/40' : ''
        ]"
      />
    </div>
    <div class="min-h-0 min-w-0 overflow-hidden" :style="{ flex: splitPaneFlex(1 - ratio) }">
      <slot name="second" />
    </div>
  </div>
</template>
