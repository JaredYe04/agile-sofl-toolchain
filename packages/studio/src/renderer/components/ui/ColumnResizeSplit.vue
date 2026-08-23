<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    widths: number[]
    collapsed?: boolean[]
    min?: number
  }>(),
  { collapsed: () => [], min: 0.08 }
)

const emit = defineEmits<{ 'update:widths': [value: number[]] }>()

const container = ref<HTMLElement | null>(null)
const dragging = ref<number | null>(null)

const count = computed(() => props.widths.length)

function visibleWidth(index: number): number {
  if (props.collapsed[index]) return 0
  return props.widths[index] ?? 0
}

function onMouseDown(index: number, e: MouseEvent): void {
  dragging.value = index
  e.preventDefault()
}

function onMouseMove(e: MouseEvent): void {
  const i = dragging.value
  if (i == null || !container.value) return
  const rect = container.value.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const next = [...props.widths]
  const left = next.slice(0, i + 1).reduce((a, b, idx) => a + (props.collapsed[idx] ? 0 : b), 0)
  const delta = x - left
  const min = props.min
  const a = (next[i] ?? 0) + delta
  const b = (next[i + 1] ?? 0) - delta
  if (a < min || b < min) return
  next[i] = a
  next[i + 1] = b
  emit('update:widths', next)
}

function onMouseUp(): void {
  dragging.value = null
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
  <div ref="container" class="flex h-full min-h-0 w-full min-w-0">
    <template v-for="i in count" :key="i">
      <div
        class="relative min-h-0 min-w-0 overflow-hidden"
        :style="
          collapsed[i - 1]
            ? { width: '0px', flex: '0 0 0px' }
            : { width: `${visibleWidth(i - 1) * 100}%`, flex: '0 0 auto' }
        "
      >
        <slot :name="`col-${i - 1}`" />
      </div>
      <div
        v-if="i < count"
        class="group/resize relative z-20 flex w-3 shrink-0 items-center justify-center"
      >
        <div
          class="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 cursor-col-resize bg-border-subtle transition-colors duration-150 group-hover/resize:bg-accent/40"
          @mousedown="onMouseDown(i - 1, $event)"
        />
        <slot :name="`bar-${i - 1}`" />
      </div>
    </template>
  </div>
</template>
