<script setup lang="ts">
export type SegmentedChoiceOption = {
  id: string
  label: string
  description?: string
}

defineProps<{
  modelValue: string
  options: SegmentedChoiceOption[]
}>()

const emit = defineEmits<{ 'update:modelValue': [id: string] }>()
</script>

<template>
  <div
    class="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2"
    role="radiogroup"
  >
    <button
      v-for="opt in options"
      :key="opt.id"
      type="button"
      role="radio"
      class="rounded-lg border p-2.5 text-left transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      :class="
        modelValue === opt.id
          ? 'border-accent bg-accent/10 text-content-primary'
          : 'border-border-subtle bg-surface-raised text-content-secondary hover:border-accent/30 hover:bg-surface-overlay hover:text-content-primary'
      "
      :aria-checked="modelValue === opt.id"
      @click="emit('update:modelValue', opt.id)"
    >
      <span class="block text-[13px] font-medium leading-snug">{{ opt.label }}</span>
      <span
        v-if="opt.description"
        class="mt-0.5 block text-[12px] leading-snug"
        :class="modelValue === opt.id ? 'text-content-secondary' : 'text-content-muted'"
      >
        {{ opt.description }}
      </span>
    </button>
  </div>
</template>
