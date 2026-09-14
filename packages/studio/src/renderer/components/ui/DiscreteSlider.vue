<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    labels?: string[]
    leftHint?: string
    rightHint?: string
  }>(),
  { min: 0, max: 4 }
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const trackRef = ref<HTMLElement | null>(null)
const dragging = ref(false)
const liveRatio = ref<number | null>(null)
let capturedPointerId: number | null = null

const ticks = computed(() => {
  const values: number[] = []
  for (let i = props.min; i <= props.max; i++) values.push(i)
  return values
})

const span = computed(() => Math.max(1, props.max - props.min))
const current = computed(() => Math.min(props.max, Math.max(props.min, props.modelValue)))

const snappedPercent = computed(() => ((current.value - props.min) / span.value) * 100)

const displayPercent = computed(() => {
  if (liveRatio.value == null) return snappedPercent.value
  return liveRatio.value * 100
})

function tickPercent(tick: number): number {
  return ((tick - props.min) / span.value) * 100
}

function labelOf(tick: number): string {
  return props.labels?.[tick - props.min] ?? String(tick)
}

function clampTick(value: number): number {
  return Math.min(props.max, Math.max(props.min, Math.round(value)))
}

function ratioFromClientX(clientX: number): number {
  const el = trackRef.value
  if (!el) return (current.value - props.min) / span.value
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0) return (current.value - props.min) / span.value
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
}

function valueFromRatio(ratio: number): number {
  return clampTick(props.min + ratio * (props.max - props.min))
}

function setValue(value: number): void {
  const next = clampTick(value)
  if (next !== props.modelValue) emit('update:modelValue', next)
}

function applyClientX(clientX: number): void {
  const ratio = ratioFromClientX(clientX)
  liveRatio.value = ratio
  setValue(valueFromRatio(ratio))
}

function stopDrag(event?: PointerEvent): void {
  dragging.value = false
  liveRatio.value = null
  window.removeEventListener('pointermove', onWindowMove)
  window.removeEventListener('pointerup', onWindowUp)
  window.removeEventListener('pointercancel', onWindowUp)
  const el = trackRef.value
  if (event && el && capturedPointerId != null && el.hasPointerCapture(capturedPointerId)) {
    el.releasePointerCapture(capturedPointerId)
  }
  capturedPointerId = null
}

function onWindowMove(event: PointerEvent): void {
  if (!dragging.value) return
  applyClientX(event.clientX)
}

function onWindowUp(event: PointerEvent): void {
  if (dragging.value) applyClientX(event.clientX)
  stopDrag(event)
}

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  event.preventDefault()
  dragging.value = true
  capturedPointerId = event.pointerId
  const el = event.currentTarget as HTMLElement
  el.setPointerCapture(event.pointerId)
  el.focus()
  applyClientX(event.clientX)
  window.addEventListener('pointermove', onWindowMove)
  window.addEventListener('pointerup', onWindowUp)
  window.addEventListener('pointercancel', onWindowUp)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
    event.preventDefault()
    setValue(current.value - 1)
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
    event.preventDefault()
    setValue(current.value + 1)
  } else if (event.key === 'Home') {
    event.preventDefault()
    setValue(props.min)
  } else if (event.key === 'End') {
    event.preventDefault()
    setValue(props.max)
  }
}

onUnmounted(() => stopDrag())
</script>

<template>
  <div class="select-none">
    <div v-if="leftHint || rightHint" class="mb-1 flex items-center justify-between gap-3 text-[11px] text-content-muted">
      <span>{{ leftHint }}</span>
      <span class="text-right">{{ rightHint }}</span>
    </div>

    <div class="px-3">
      <div
        ref="trackRef"
        class="relative h-11 cursor-pointer touch-none outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
        role="slider"
        tabindex="0"
        :aria-valuemin="min"
        :aria-valuemax="max"
        :aria-valuenow="current"
        :aria-valuetext="labelOf(current)"
        @pointerdown="onPointerDown"
        @keydown="onKeydown"
      >
        <div class="pointer-events-none absolute inset-x-0 top-[18px] h-2 -translate-y-1/2 rounded-full bg-surface-overlay" />
        <div
          class="pointer-events-none absolute top-[18px] h-2 -translate-y-1/2 rounded-full bg-accent"
          :style="{ width: `${displayPercent}%` }"
        />

        <span
          v-for="tick in ticks"
          :key="`mark-${tick}`"
          class="pointer-events-none absolute top-[26px] h-2 w-px -translate-x-1/2 rounded-full"
          :class="tick <= current ? 'bg-accent/80' : 'bg-content-muted/55'"
          :style="{ left: `${tickPercent(tick)}%` }"
        />

        <div
          class="pointer-events-none absolute top-[18px] z-[2] h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-sm ring-2 ring-accent/25"
          :style="{ left: `${displayPercent}%` }"
        />
      </div>

      <div class="relative mt-0.5 h-8">
        <span
          v-for="tick in ticks"
          :key="`label-${tick}`"
          class="absolute top-0 max-w-[4.6rem] text-[10px] leading-tight text-content-muted"
          :class="tick === current ? 'font-medium text-accent' : ''"
          :style="{
            left: `${tickPercent(tick)}%`,
            transform: tick === min ? 'none' : tick === max ? 'translateX(-100%)' : 'translateX(-50%)',
            textAlign: tick === min ? 'left' : tick === max ? 'right' : 'center'
          }"
        >
          {{ labelOf(tick) }}
        </span>
      </div>
    </div>
  </div>
</template>
