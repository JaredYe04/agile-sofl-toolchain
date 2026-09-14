<script setup lang="ts">
import { computed, useSlots } from 'vue'

const props = defineProps<{
  modelValue: boolean
  disabled?: boolean
  label?: string
  description?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const slots = useSlots()
const hasText = computed(() => Boolean(props.label || slots.default || props.description))

function onChange(event: Event): void {
  if (props.disabled) return
  emit('update:modelValue', (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <label
    class="group inline-flex max-w-full items-start gap-2 select-none"
    :class="disabled ? 'pointer-events-none opacity-40' : 'cursor-pointer'"
  >
    <span class="relative mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <input
        type="checkbox"
        class="peer sr-only"
        :checked="modelValue"
        :disabled="disabled"
        @change="onChange"
      />
      <span
        class="flex h-4 w-4 items-center justify-center rounded-sm border transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-raised"
        :class="
          modelValue
            ? 'border-accent bg-accent'
            : 'border-border-subtle bg-surface-raised group-hover:border-accent/50'
        "
      >
        <svg
          v-show="modelValue"
          class="h-3 w-3"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3.5 8.5 6.5 11.5 12.5 4.5"
            stroke="white"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    </span>
    <span v-if="hasText" class="min-w-0">
      <span class="block text-[13px] leading-snug text-content-primary">
        <slot>{{ label }}</slot>
      </span>
      <span v-if="description" class="mt-0.5 block text-[12px] leading-snug text-content-secondary">
        {{ description }}
      </span>
    </span>
  </label>
</template>
