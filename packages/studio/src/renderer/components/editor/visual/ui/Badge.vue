<script setup lang="ts">
const props = defineProps<{
  variant?: 'process' | 'function' | 'formal' | 'semi-formal' | 'warning' | 'neutral'
}>()

const variantClass: Record<string, string> = {
  process: 'bg-role-process/15 text-role-process',
  function: 'bg-role-function/15 text-role-function',
  formal: 'bg-accent/10 text-accent',
  'semi-formal': 'bg-semantic-warning/15 text-semantic-warning',
  warning: 'bg-semantic-warning/15 text-semantic-warning',
  neutral: 'bg-surface-base text-content-secondary'
}
</script>

<template>
  <span
    class="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide"
    :class="variantClass[props.variant ?? 'neutral']"
  >
    <slot />
  </span>
</template>
