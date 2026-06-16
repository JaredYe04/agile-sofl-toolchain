<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEditorUiStore } from '../../stores/editorUi'

const { t } = useI18n()
const editorUi = useEditorUiStore()
const dragging = ref(false)
const dragStartX = ref(0)
const dragStartWidth = ref(0)

function onMouseDown(e: MouseEvent): void {
  if (!editorUi.showProjectSidebar) return
  dragging.value = true
  dragStartX.value = e.clientX
  dragStartWidth.value = editorUi.projectSidebarWidth
  e.preventDefault()
}

function onMouseMove(e: MouseEvent): void {
  if (!dragging.value) return
  const delta = e.clientX - dragStartX.value
  editorUi.setProjectSidebarWidth(dragStartWidth.value + delta)
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
  <div class="relative flex h-full min-h-0 w-full min-w-0 flex-1">
    <div
      v-if="!editorUi.showProjectSidebar"
      class="group/edge absolute left-0 top-0 z-20 flex h-full w-6 items-center justify-start"
    >
      <button
        type="button"
        class="flex h-16 w-5 items-center justify-center rounded-r-md border border-l-0 border-border-subtle bg-surface-raised text-content-secondary opacity-0 shadow-sm transition-all duration-150 group-hover/edge:opacity-100 hover:bg-surface-overlay hover:text-content-primary"
        :title="t('sidebar.expand')"
        :aria-label="t('sidebar.expand')"
        @click="editorUi.setShowProjectSidebar(true)"
      >
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fill-rule="evenodd"
            d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>
    <div
      v-show="editorUi.showProjectSidebar"
      class="min-h-0 shrink-0 overflow-visible"
      :style="{ width: `${editorUi.projectSidebarWidth}px` }"
    >
      <slot name="sidebar" />
    </div>
    <div
      v-if="editorUi.showProjectSidebar"
      class="group/resize relative z-20 flex w-3 shrink-0 items-center justify-center"
    >
      <div
        class="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 cursor-col-resize bg-border-subtle transition-colors duration-150 group-hover/resize:bg-accent/40"
        @mousedown="onMouseDown"
      />
      <button
        type="button"
        class="relative z-10 flex h-16 w-5 cursor-pointer items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-content-secondary opacity-0 shadow-sm transition-all duration-150 group-hover/resize:opacity-100 hover:bg-surface-overlay hover:text-content-primary"
        :title="t('sidebar.collapse')"
        :aria-label="t('sidebar.collapse')"
        @mousedown.stop
        @click="editorUi.setShowProjectSidebar(false)"
      >
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fill-rule="evenodd"
            d="M11.78 5.22a.75.75 0 0 1 0 1.06L7.56 10l3.94 3.72a.75.75 0 1 1-1.04 1.06l-4.5-4.25a.75.75 0 0 1 0-1.06l4.5-4.25a.75.75 0 0 1 1.04.08Z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>
    <div class="min-h-0 min-w-0 w-full flex-1 overflow-hidden">
      <slot name="main" />
    </div>
  </div>
</template>
