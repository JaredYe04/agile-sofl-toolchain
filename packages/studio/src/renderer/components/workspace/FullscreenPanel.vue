<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useWorkspaceStore, type WorkspacePanelId } from '../../stores/workspace'

const props = defineProps<{
  panelId: WorkspacePanelId
}>()

const workspace = useWorkspaceStore()
const isFullscreen = computed(() => workspace.fullscreenPanel === props.panelId)

function close(): void {
  if (isFullscreen.value) workspace.setFullscreenPanel(null)
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') close()
}

function notifyLayout(): void {
  void nextTick(() => {
    window.dispatchEvent(new Event('resize'))
  })
}

watch(isFullscreen, notifyLayout)

onMounted(() => {
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  if (workspace.fullscreenPanel === props.panelId) {
    workspace.setFullscreenPanel(null)
  }
})
</script>

<template>
  <div class="relative h-full min-h-0 w-full min-w-0">
    <div v-if="isFullscreen" class="h-full min-h-0 w-full" aria-hidden="true" />
    <Teleport to="body" :disabled="!isFullscreen">
      <div
        class="min-h-0 min-w-0"
        :class="isFullscreen ? 'fixed inset-0 z-[95]' : 'relative h-full w-full'"
      >
        <div
          v-if="isFullscreen"
          class="absolute inset-0 bg-black/45"
          @click="close"
        />
        <div
          class="flex min-h-0 min-w-0 flex-col overflow-hidden bg-surface-base"
          :class="
            isFullscreen
              ? 'absolute inset-4 z-[1] rounded-xl border border-border-subtle shadow-2xl'
              : 'relative h-full w-full'
          "
        >
          <slot />
        </div>
      </div>
    </Teleport>
  </div>
</template>
