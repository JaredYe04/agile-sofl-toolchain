<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SectionCard from '../visual/ui/SectionCard.vue'
import FormField from '../visual/ui/FormField.vue'
import TextField from '../visual/ui/TextField.vue'

const props = defineProps<{
  purpose: string
  scope?: string
  assumptions?: string
  stakeholders?: string[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  patchPurpose: [v: string]
  patchScope: [v: string]
  patchAssumptions: [v: string]
  patchStakeholders: [v: string]
}>()

const { t } = useI18n()
const purposeDraft = ref('')
const scopeDraft = ref('')
const assumptionsDraft = ref('')
const stakeholdersDraft = ref('')

watch(
  () => props,
  (p) => {
    purposeDraft.value = p.purpose
    scopeDraft.value = p.scope ?? ''
    assumptionsDraft.value = p.assumptions ?? ''
    stakeholdersDraft.value = (p.stakeholders ?? []).join(', ')
  },
  { immediate: true, deep: true }
)

watch(purposeDraft, (v) => {
  if (v !== props.purpose) emit('patchPurpose', v)
})
watch(scopeDraft, (v) => {
  if (v !== (props.scope ?? '')) emit('patchScope', v)
})
watch(assumptionsDraft, (v) => {
  if (v !== (props.assumptions ?? '')) emit('patchAssumptions', v)
})
watch(stakeholdersDraft, (v) => {
  const list = v.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
  const cur = (props.stakeholders ?? []).join(', ')
  if (v.replace(/\s/g, '') !== cur.replace(/\s/g, '')) emit('patchStakeholders', v)
})
</script>

<template>
  <SectionCard :title="t('informal.systemOverview')">
    <FormField :label="t('informal.purpose')">
      <TextField v-model="purposeDraft" :rows="4" :disabled="disabled" />
    </FormField>
    <FormField :label="t('informal.scope')" class="mt-3">
      <TextField v-model="scopeDraft" :rows="3" :disabled="disabled" />
    </FormField>
    <FormField :label="t('informal.assumptions')" class="mt-3">
      <TextField v-model="assumptionsDraft" :rows="2" :disabled="disabled" />
    </FormField>
    <FormField :label="t('informal.stakeholders')" class="mt-3">
      <TextField v-model="stakeholdersDraft" :rows="1" :disabled="disabled" :placeholder="t('informal.stakeholdersHint')" />
    </FormField>
  </SectionCard>
</template>
