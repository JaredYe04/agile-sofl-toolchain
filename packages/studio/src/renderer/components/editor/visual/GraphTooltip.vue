<script setup lang="ts">
defineProps<{
  x: number
  y: number
  text: string
}>()
</script>

<template>
  <div
    class="pointer-events-none fixed z-50 max-w-xs rounded-md border border-border-subtle bg-surface-raised px-2 py-1 text-xs text-content-primary shadow-lg"
    :style="{ left: `${x + 12}px`, top: `${y + 12}px` }"
  >
    {{ text }}
  </div>
</template>
