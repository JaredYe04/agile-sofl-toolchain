<script setup lang="ts">
defineProps<{
  message: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-subtle bg-surface-raised/50 px-6 py-10 text-center">
    <p class="text-sm text-content-muted">{{ message }}</p>
    <div v-if="$slots.action" class="mt-3">
      <slot name="action" />
    </div>
  </div>
</template>
