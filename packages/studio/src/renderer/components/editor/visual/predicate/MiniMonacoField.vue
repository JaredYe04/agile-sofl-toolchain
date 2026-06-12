<script setup lang="ts">
import CodeField from '../ui/CodeField.vue'
import type { SymbolHint } from './predicateTypes'

defineProps<{
  modelValue: string
  disabled?: boolean
  rows?: number
  symbols?: SymbolHint[]
  bordered?: boolean
}>()

defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <CodeField v-bind="$props" @update:model-value="$emit('update:modelValue', $event)" />
</template>
