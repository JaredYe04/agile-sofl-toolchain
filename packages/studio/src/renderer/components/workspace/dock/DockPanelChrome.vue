<script setup lang="ts">
import type { DockPanelId, DockZone } from '../../../lib/dockLayout'
import StudioIcon from '../../ui/StudioIcon.vue'

defineProps<{
  panel: DockPanelId
  title: string
  dirty?: boolean
  dropZone: DockZone | null
  dragging: boolean
}>()

const emit = defineEmits<{ dragStart: [panel: DockPanelId, e: PointerEvent] }>()
</script>

<template>
  <header
    class="flex h-[32px] min-w-0 shrink-0 cursor-grab flex-nowrap items-center gap-1 overflow-hidden border-b border-border-subtle bg-surface-base px-1 active:cursor-grabbing"
    :data-dock-panel="panel"
    @pointerdown="emit('dragStart', panel, $event)"
  >
    <span
      class="flex shrink-0 items-center text-content-muted"
      :title="$t('workspace.dock.dragHint')"
    >
      <StudioIcon icon="lucide:grip-vertical" :size="14" />
    </span>
    <slot name="title">
      <h2 class="min-w-0 truncate text-xs font-semibold text-content-primary">{{ title }}</h2>
      <span v-if="dirty" class="shrink-0 text-[10px] text-accent">●</span>
    </slot>
    <div class="ml-auto flex shrink-0 items-center gap-1">
      <slot name="actions" />
    </div>
  </header>
</template>
