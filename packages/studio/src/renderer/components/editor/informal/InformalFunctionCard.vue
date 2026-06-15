<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SectionCard from '../visual/ui/SectionCard.vue'
import FormField from '../visual/ui/FormField.vue'
import TextField from '../visual/ui/TextField.vue'

const props = defineProps<{
  fn: { id: string; name: string; description?: string; bodyHint?: string }
  disabled?: boolean
}>()

const emit = defineEmits<{ patch: [idPath: string, value: unknown] }>()
const { t } = useI18n()
const desc = ref('')
const bodyHint = ref('')

watch(
  () => props.fn,
  (f) => {
    desc.value = f.description ?? ''
    bodyHint.value = f.bodyHint ?? ''
  },
  { immediate: true, deep: true }
)

watch(desc, (v) => {
  if (v !== (props.fn.description ?? '')) emit('patch', `function.${props.fn.id}.description`, v)
})
watch(bodyHint, (v) => {
  if (v !== (props.fn.bodyHint ?? '')) emit('patch', `function.${props.fn.id}.bodyHint`, v)
})
</script>

<template>
  <SectionCard :title="fn.name">
    <FormField :label="t('informal.functionDescription')">
      <TextField v-model="desc" :rows="3" :disabled="disabled" />
    </FormField>
    <FormField :label="t('informal.bodyHint')" class="mt-3">
      <TextField v-model="bodyHint" :rows="2" :disabled="disabled" />
    </FormField>
  </SectionCard>
</template>
