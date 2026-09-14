<script setup lang="ts">
import StudioIcon from './StudioIcon.vue'

type Variant = 'neutral' | 'accent' | 'process' | 'function' | 'danger'

withDefaults(
  defineProps<{
    icon: string
    label: string
    disabled?: boolean
    variant?: Variant
    spin?: boolean
  }>(),
  { variant: 'neutral', disabled: false, spin: false }
)

defineEmits<{ click: [e: MouseEvent] }>()

const variantClass: Record<Variant, string> = {
  neutral: 'text-content-secondary hover:bg-surface-overlay hover:text-content-primary',
  accent: 'text-accent hover:bg-accent/10',
  process: 'text-role-process hover:bg-role-process/10',
  function: 'text-role-function hover:bg-role-function/10',
  danger: 'text-semantic-error hover:bg-semantic-error/10'
}
</script>

<template>
  <button
    type="button"
    class="flex shrink-0 items-center justify-center rounded-md p-1.5 transition-colors disabled:opacity-40"
    :class="variantClass[variant]"
    :title="label"
    :aria-label="label"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <span class="inline-flex" :class="spin ? 'animate-spin' : undefined">
      <StudioIcon :icon="icon" :size="16" />
    </span>
  </button>
</template>
