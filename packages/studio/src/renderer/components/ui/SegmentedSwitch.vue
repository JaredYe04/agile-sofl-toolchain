<script setup lang="ts">
import { computed } from 'vue'

export type SegmentedOption = { id: string; label: string }

const props = defineProps<{
  modelValue: string
  options: SegmentedOption[]
}>()

const emit = defineEmits<{ 'update:modelValue': [id: string] }>()

const activeIndex = computed(() => {
  const idx = props.options.findIndex((o) => o.id === props.modelValue)
  return idx < 0 ? 0 : idx
})

const count = computed(() => Math.max(1, props.options.length))
</script>

<template>
  <div
    class="relative isolate inline-grid h-7 min-w-0 max-w-full shrink select-none rounded-lg bg-surface-overlay p-[3px]"
    :style="{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }"
    role="tablist"
  >
    <div
      class="pointer-events-none absolute top-[3px] left-[3px] z-0 h-[calc(100%-6px)] rounded-md bg-accent shadow-sm transition-transform duration-200 ease-out"
      :style="{
        width: `calc((100% - 6px) / ${count})`,
        transform: `translateX(calc(${activeIndex} * 100% + ${activeIndex * 3}px))`
      }"
    />
    <button
      v-for="opt in options"
      :key="opt.id"
      type="button"
      role="tab"
      class="relative z-10 min-w-0 truncate rounded-md px-2.5 text-[11px] font-medium transition-colors duration-200"
      :title="opt.label"
      :class="
        modelValue === opt.id
          ? 'text-accent-fg'
          : 'text-content-secondary hover:text-content-primary'
      "
      :aria-selected="modelValue === opt.id"
      @click="emit('update:modelValue', opt.id)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
