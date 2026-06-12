<script setup lang="ts">
defineProps<{
  label?: string
  hint?: string
  error?: string | null
  htmlFor?: string
}>()
</script>

<template>
  <div class="space-y-1.5">
    <label v-if="label" :for="htmlFor" class="block text-sm font-medium text-content-secondary">
      {{ label }}
    </label>
    <slot />
    <p v-if="error" class="text-xs text-semantic-error">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-content-muted">{{ hint }}</p>
  </div>
</template>
