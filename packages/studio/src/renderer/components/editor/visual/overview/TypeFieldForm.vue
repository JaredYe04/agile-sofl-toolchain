<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import FormField from '../ui/FormField.vue'
import TextField from '../ui/TextField.vue'
import { BASIC_TYPES, type TypeFieldDraft } from '../../../../lib/visualDecls'

const props = defineProps<{
  field: TypeFieldDraft
  extraTypes?: string[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:field': [value: TypeFieldDraft]
}>()

const { t } = useI18n()

const typeOptions = computed(() => {
  const extra = (props.extraTypes ?? []).filter((ty) => !BASIC_TYPES.includes(ty))
  const current = props.field.type
  const all = [...BASIC_TYPES, ...extra]
  if (current && !all.includes(current)) all.push(current)
  return all
})

function patch(partial: Partial<TypeFieldDraft>): void {
  emit('update:field', { ...props.field, ...partial })
}
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2">
    <FormField :label="t('visual.typeField')">
      <TextField :model-value="field.name" mono :disabled="disabled" @update:model-value="patch({ name: $event })" />
    </FormField>
    <FormField :label="t('visual.typeFieldType')">
      <select
        class="visual-field w-full px-3 py-2 text-sm"
        :value="field.type"
        :disabled="disabled"
        @change="patch({ type: ($event.target as HTMLSelectElement).value })"
      >
        <option v-for="ty in typeOptions" :key="ty" :value="ty">{{ ty }}</option>
      </select>
    </FormField>
  </div>
</template>
