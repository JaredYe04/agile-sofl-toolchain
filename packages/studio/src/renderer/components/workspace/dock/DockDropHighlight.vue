<script setup lang="ts">
import type { DockZone } from '../../../lib/dockLayout'

defineProps<{ active: boolean; zone: DockZone | null }>()
</script>

<template>
  <div v-if="active && zone" class="pointer-events-none absolute inset-0 z-20">
    <div
      class="absolute box-border rounded-sm border-2 border-dashed border-white/55 dark:border-white/45"
      :class="{
        'left-0 top-0 h-full w-1/4': zone === 'left',
        'right-0 top-0 h-full w-1/4': zone === 'right',
        'left-0 top-0 h-1/4 w-full': zone === 'top',
        'bottom-0 left-0 h-1/4 w-full': zone === 'bottom'
      }"
    />
  </div>
</template>
