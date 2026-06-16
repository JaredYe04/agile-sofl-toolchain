<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    ratio: number
    minLeft?: number
    minRight?: number
  }>(),
  { minLeft: 0.15, minRight: 0.2 }
)

const emit = defineEmits<{ 'update:ratio': [value: number] }>()

const container = ref<HTMLElement | null>(null)
const dragging = ref(false)

function clamp(r: number): number {
  return Math.min(1 - props.minRight, Math.max(props.minLeft, r))
}

function onMouseDown(e: MouseEvent): void {
  dragging.value = true
  e.preventDefault()
}

function onMouseMove(e: MouseEvent): void {
  if (!dragging.value || !container.value) return
  const rect = container.value.getBoundingClientRect()
  const ratio = clamp((e.clientX - rect.left) / rect.width)
  emit('update:ratio', ratio)
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
</script>

<template>
  <div ref="container" class="flex h-full min-h-0 w-full min-w-0 flex-1">
    <div
      class="min-h-0 shrink-0 overflow-hidden"
      :style="{ width: `${ratio * 100}%` }"
    >
      <slot name="left" />
    </div>
    <div
      class="group flex w-1 shrink-0 cursor-col-resize items-stretch bg-border-subtle transition-colors duration-150 hover:bg-accent/40"
      @mousedown="onMouseDown"
    >
      <div class="w-full" />
    </div>
    <div class="min-h-0 min-w-0 w-full flex-1 overflow-hidden">
      <slot name="right" />
    </div>
  </div>
</template>
