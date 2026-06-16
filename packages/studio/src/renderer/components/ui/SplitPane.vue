<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useEditorUiStore } from '../../stores/editorUi'

const props = defineProps<{
  showLeft: boolean
  showRight: boolean
}>()

const editorUi = useEditorUiStore()
const container = ref<HTMLElement | null>(null)
const dragging = ref(false)

function onMouseDown(e: MouseEvent): void {
  if (!props.showLeft || !props.showRight) return
  dragging.value = true
  e.preventDefault()
}

function onMouseMove(e: MouseEvent): void {
  if (!dragging.value || !container.value) return
  const rect = container.value.getBoundingClientRect()
  const ratio = (e.clientX - rect.left) / rect.width
  editorUi.setSplitRatio(ratio)
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
      v-show="showLeft"
      class="min-h-0 min-w-0 overflow-hidden"
      :style="
        showRight
          ? { width: `${editorUi.splitRatio * 100}%`, flex: '0 0 auto' }
          : { flex: '1 1 0', width: '100%' }
      "
    >
      <slot name="left" />
    </div>
    <div
      v-if="showLeft && showRight"
      class="group flex w-1 shrink-0 cursor-col-resize items-stretch bg-border-subtle transition-colors duration-150 hover:bg-accent/40"
      @mousedown="onMouseDown"
    >
      <div class="w-full" />
    </div>
    <div v-show="showRight" class="min-h-0 min-w-0 w-full flex-1 overflow-hidden">
      <slot name="right" />
    </div>
  </div>
</template>
