<script setup lang="ts">
import { computed } from 'vue'
import Badge from '../../editor/visual/ui/Badge.vue'
import { basename } from '../../../composables/useProjectScan'
import { filePathsEqual } from '../../../stores/tabUtils'

const props = defineProps<{
  path: string
  activePath?: string | null
}>()

defineEmits<{ open: [path: string]; contextmenu: [event: MouseEvent] }>()

const ext = computed(() => {
  if (props.path.endsWith('.guispec')) return '.guispec'
  if (props.path.endsWith('.aspec')) return '.aspec'
  return '.asfl'
})

const badgeVariant = computed(() => {
  if (ext.value === '.aspec') return 'semi-formal' as const
  if (ext.value === '.guispec') return 'neutral' as const
  return 'formal' as const
})

const isActive = computed(() =>
  props.activePath ? filePathsEqual(props.activePath, props.path) : false
)
</script>

<template>
  <button
    type="button"
    class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-overlay"
    :class="isActive ? 'bg-accent/10 text-content-primary' : 'text-content-secondary'"
    :title="path"
    @click="$emit('open', path)"
    @contextmenu.prevent.stop="$emit('contextmenu', $event)"
  >
    <Badge :variant="badgeVariant">{{ ext }}</Badge>
    <span class="truncate">{{ basename(path) }}</span>
  </button>
</template>
