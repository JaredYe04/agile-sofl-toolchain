<script setup lang="ts">
import type { DockNode } from '../../../lib/dockLayout'

defineProps<{ node: DockNode }>()
</script>

<template>
  <div
    v-if="node.kind === 'panel'"
    class="h-full w-full rounded-md border-2 border-dashed border-white/55 dark:border-white/45"
  />
  <div
    v-else
    class="flex h-full w-full gap-1 p-1"
    :class="node.direction === 'vertical' ? 'flex-col' : 'flex-row'"
  >
    <div
      class="min-h-0 min-w-0 overflow-hidden"
      :style="
        node.direction === 'vertical'
          ? { height: `${node.ratio * 100}%`, flex: '0 0 auto' }
          : { width: `${node.ratio * 100}%`, flex: '0 0 auto' }
      "
    >
      <DockLayoutPreview :node="node.first" />
    </div>
    <div class="min-h-0 min-w-0 flex-1 overflow-hidden">
      <DockLayoutPreview :node="node.second" />
    </div>
  </div>
</template>
