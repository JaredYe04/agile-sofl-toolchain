<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string
    disabled?: boolean
    rows?: number
    id?: string
    placeholder?: string
    mono?: boolean
  }>(),
  { rows: 1, mono: false }
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function onInput(e: Event): void {
  emit('update:modelValue', (e.target as HTMLTextAreaElement | HTMLInputElement).value)
}
</script>

<template>
  <textarea
    v-if="rows > 1"
    :id="id"
    :value="modelValue"
    :rows="rows"
    :disabled="disabled"
    :placeholder="placeholder"
    class="visual-field w-full resize-y px-3 py-2 text-sm disabled:opacity-50"
    :class="mono ? 'font-mono' : ''"
    @input="onInput"
  />
  <input
    v-else
    :id="id"
    :value="modelValue"
    type="text"
    :disabled="disabled"
    :placeholder="placeholder"
    class="visual-field w-full px-3 py-2 text-sm disabled:opacity-50"
    :class="mono ? 'font-mono' : ''"
    @input="onInput"
  />
</template>
