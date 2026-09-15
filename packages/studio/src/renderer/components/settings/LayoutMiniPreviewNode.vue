<script setup lang="ts">
import type { LayoutTopology } from '../../../shared/workspaceLayout'

defineProps<{ topo: LayoutTopology }>()
</script>

<template>
  <div
    v-if="topo.kind === 'slot'"
    class="flex min-h-0 min-w-0 items-center justify-center rounded-[2px] border border-dashed border-content-muted/50 bg-surface-overlay/60 text-[9px] font-semibold text-content-muted"
  >
    {{ topo.index + 1 }}
  </div>
  <div
    v-else
    class="grid h-full min-h-0 w-full min-w-0 gap-px"
    :class="topo.direction === 'horizontal' ? 'grid-cols-2' : 'grid-rows-2'"
  >
    <LayoutMiniPreviewNode :topo="topo.first" />
    <LayoutMiniPreviewNode :topo="topo.second" />
  </div>
</template>
