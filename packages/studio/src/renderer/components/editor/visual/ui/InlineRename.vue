<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  modelValue: string
  editing?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:editing': [value: boolean]
  commit: [value: string]
  cancel: []
}>()

const draft = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

watch(
  () => props.editing,
  async (on) => {
    if (on) {
      draft.value = props.modelValue
      await nextTick()
      inputEl.value?.focus()
      inputEl.value?.select()
    }
  }
)

function commit(): void {
  const next = draft.value.trim()
  emit('update:editing', false)
  if (next && next !== props.modelValue) emit('commit', next)
  else emit('cancel')
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter') {
    e.preventDefault()
    commit()
  }
  if (e.key === 'Escape') {
    emit('update:editing', false)
    emit('cancel')
  }
}
</script>

<template>
  <input
    v-if="editing"
    ref="inputEl"
    v-model="draft"
    type="text"
    class="visual-field min-w-0 flex-1 px-2 py-0.5 text-lg font-semibold"
    :disabled="disabled"
    @keydown="onKeydown"
    @blur="commit"
  />
  <button
    v-else
    type="button"
    class="truncate text-left text-lg font-semibold text-content-primary hover:text-accent disabled:opacity-50"
    :disabled="disabled"
    :title="modelValue"
    @click="!disabled && emit('update:editing', true)"
  >
    {{ modelValue }}
  </button>
</template>
