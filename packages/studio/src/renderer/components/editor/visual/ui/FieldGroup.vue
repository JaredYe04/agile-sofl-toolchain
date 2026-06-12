<script setup lang="ts">
defineProps<{
  label?: string
}>()
</script>

<template>
  <div class="border-l-2 border-accent/25 py-1 pl-3">
    <p v-if="label" class="mb-1.5 text-xs font-medium uppercase tracking-wide text-content-muted">{{ label }}</p>
    <slot />
  </div>
</template>
