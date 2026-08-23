<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

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
const dragging = ref(false)

function clamp(r: number): number {
  return Math.min(1 - props.minBottom, Math.max(props.minTop, r))
}

function onMouseDown(e: MouseEvent): void {
  dragging.value = true
  e.preventDefault()
}

function onMouseMove(e: MouseEvent): void {
  if (!dragging.value || !container.value) return
  const rect = container.value.getBoundingClientRect()
  emit('update:ratio', clamp((e.clientY - rect.top) / rect.height))
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
  <div ref="container" class="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
    <div class="min-h-0 min-w-0 overflow-hidden" :style="{ height: `${ratio * 100}%`, flex: '0 0 auto' }">
      <slot name="top" />
    </div>
    <div
      class="group flex h-1 shrink-0 cursor-row-resize items-stretch bg-border-subtle transition-colors duration-150 hover:bg-accent/40"
      @mousedown="onMouseDown"
    />
    <div class="min-h-0 min-w-0 w-full flex-1 overflow-hidden">
      <slot name="bottom" />
    </div>
  </div>
</template>
