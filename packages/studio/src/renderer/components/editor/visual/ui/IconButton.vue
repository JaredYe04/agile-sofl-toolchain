<script setup lang="ts">
defineProps<{
  title?: string
  disabled?: boolean
  variant?: 'default' | 'danger'
}>()
</script>

<template>
  <button
    type="button"
    class="rounded-md px-2 py-1 text-xs transition-colors duration-150 active:scale-[0.98] disabled:opacity-40"
    :class="
      variant === 'danger'
        ? 'text-semantic-error hover:bg-semantic-error/10'
        : 'text-content-secondary hover:bg-surface-overlay hover:text-content-primary'
    "
    :title="title"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>
