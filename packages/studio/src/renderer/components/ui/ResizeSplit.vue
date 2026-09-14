<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

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
const dragging = ref(false)

function clamp(r: number): number {
  return Math.min(1 - props.minSecond, Math.max(props.minFirst, r))
}

function onMouseDown(e: MouseEvent): void {
  dragging.value = true
  e.preventDefault()
}

function onMouseMove(e: MouseEvent): void {
  if (!dragging.value || !container.value) return
  const rect = container.value.getBoundingClientRect()
  if (props.direction === 'vertical') {
    emit('update:ratio', clamp((e.clientY - rect.top) / rect.height))
  } else {
    emit('update:ratio', clamp((e.clientX - rect.left) / rect.width))
  }
}

function onMouseUp(): void {
  dragging.value = false
}

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
})
onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})

const isVertical = props.direction === 'vertical'
</script>

<template>
  <div
    ref="container"
    class="flex h-full min-h-0 w-full min-w-0 flex-1"
    :class="isVertical ? 'flex-col' : 'flex-row'"
  >
    <div
      class="min-h-0 min-w-0 overflow-hidden"
      :class="isVertical ? 'w-full' : 'h-full'"
      :style="
        isVertical
          ? { height: `${ratio * 100}%`, flex: '0 0 auto' }
          : { width: `${ratio * 100}%`, flex: '0 0 auto' }
      "
    >
      <slot name="first" />
    </div>
    <div
      class="group shrink-0 bg-border-subtle transition-colors duration-150 hover:bg-accent/40"
      :class="
        isVertical
          ? 'flex h-1 w-full cursor-row-resize items-stretch'
          : 'flex h-full w-1 cursor-col-resize items-stretch'
      "
      @mousedown="onMouseDown"
    />
    <div class="min-h-0 min-w-0 flex-1 overflow-hidden">
      <slot name="second" />
    </div>
  </div>
</template>
