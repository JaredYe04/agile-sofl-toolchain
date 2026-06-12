<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

export type SelectOption = {
  value: string | number
  label: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string | number
    options: SelectOption[]
    disabled?: boolean
    size?: 'sm' | 'md'
    id?: string
    ariaLabel?: string
  }>(),
  { size: 'md', disabled: false }
)

const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const selectedLabel = computed(
  () => props.options.find((o) => o.value === props.modelValue)?.label ?? String(props.modelValue)
)

const sizeClass = computed(() =>
  props.size === 'sm' ? 'px-2 py-1 text-sm' : 'px-3 py-2 text-sm'
)

function toggle(): void {
  if (props.disabled) return
  open.value = !open.value
}

function select(value: string | number): void {
  emit('update:modelValue', value)
  open.value = false
}

function onDocClick(e: MouseEvent): void {
  if (!open.value) return
  const el = rootRef.value
  if (el && !el.contains(e.target as Node)) open.value = false
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      :id="id"
      type="button"
      class="visual-field flex w-full items-center justify-between gap-2 text-left disabled:opacity-50"
      :class="sizeClass"
      :disabled="disabled"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      @click.stop="toggle"
    >
      <span class="truncate">{{ selectedLabel }}</span>
      <span class="shrink-0 text-content-muted" aria-hidden="true">▾</span>
    </button>
    <ul
      v-if="open"
      class="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border-subtle bg-surface-raised py-1 shadow-lg"
      role="listbox"
    >
      <li v-for="opt in options" :key="String(opt.value)" role="option">
        <button
          type="button"
          class="w-full px-3 py-1.5 text-left text-sm hover:bg-surface-overlay"
          :class="opt.value === modelValue ? 'bg-accent/10 text-accent' : 'text-content-primary'"
          @click.stop="select(opt.value)"
        >
          {{ opt.label }}
        </button>
      </li>
    </ul>
  </div>
</template>
