<script setup lang="ts">
defineProps<{ label: string; title?: string; disabled?: boolean }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    class="titlebar-no-drag inline-flex items-center rounded-md px-2 py-0.5 text-[13px] text-content-secondary transition-colors duration-150 hover:bg-surface-overlay hover:text-content-primary active:scale-[0.98] disabled:opacity-40"
    :title="title"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <slot>{{ label }}</slot>
  </button>
</template>
