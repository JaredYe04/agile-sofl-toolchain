<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SectionCard from '../visual/ui/SectionCard.vue'
import FormField from '../visual/ui/FormField.vue'
import TextField from '../visual/ui/TextField.vue'

type FunctionPayload = {
  id: string
  name: string
  description?: string
  bodyHint?: string
  signature?: {
    inputs?: Array<{ name: string; typeHint?: string }>
    outputs?: Array<{ name: string; typeHint?: string }>
  }
  refinementHints?: { bottomLevel?: boolean; expectedFsfLevel?: 'semi-formal' | 'formal' }
}

const props = defineProps<{
  fn: FunctionPayload
  disabled?: boolean
}>()

const emit = defineEmits<{ patch: [idPath: string, value: unknown] }>()
const { t } = useI18n()
const desc = ref('')
const bodyHint = ref('')
const inputName = ref('')
const inputType = ref('nat')
const outputName = ref('result')
const outputType = ref('nat')
const expectedFsfLevel = ref<'semi-formal' | 'formal'>('semi-formal')

watch(
  () => props.fn,
  (f) => {
    desc.value = f.description ?? ''
    bodyHint.value = f.bodyHint ?? ''
    inputName.value = f.signature?.inputs?.[0]?.name ?? 'id'
    inputType.value = f.signature?.inputs?.[0]?.typeHint ?? 'nat'
    outputName.value = f.signature?.outputs?.[0]?.name ?? 'result'
    outputType.value = f.signature?.outputs?.[0]?.typeHint ?? 'nat'
    expectedFsfLevel.value = f.refinementHints?.expectedFsfLevel ?? 'semi-formal'
  },
  { immediate: true, deep: true }
)

watch(desc, (v) => {
  if (v !== (props.fn.description ?? '')) emit('patch', `function.${props.fn.id}.description`, v)
})
watch(bodyHint, (v) => {
  if (v !== (props.fn.bodyHint ?? '')) emit('patch', `function.${props.fn.id}.bodyHint`, v)
})

function emitSignature(): void {
  const signature = {
    inputs: [{ name: inputName.value.trim() || 'id', typeHint: inputType.value.trim() || 'nat' }],
    outputs: [{ name: outputName.value.trim() || 'result', typeHint: outputType.value.trim() || 'nat' }]
  }
  emit('patch', `function.${props.fn.id}.signature`, signature)
}

watch([inputName, inputType, outputName, outputType], emitSignature)

watch(expectedFsfLevel, (v) => {
  if (v !== (props.fn.refinementHints?.expectedFsfLevel ?? 'semi-formal')) {
    emit('patch', `function.${props.fn.id}.refinementHints`, {
      ...props.fn.refinementHints,
      expectedFsfLevel: v
    })
  }
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
    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      <FormField :label="t('informal.inputParam')">
        <TextField v-model="inputName" :disabled="disabled" />
      </FormField>
      <FormField :label="t('informal.inputType')">
        <TextField v-model="inputType" mono :disabled="disabled" />
      </FormField>
      <FormField :label="t('informal.outputParam')">
        <TextField v-model="outputName" :disabled="disabled" />
      </FormField>
      <FormField :label="t('informal.outputType')">
        <TextField v-model="outputType" mono :disabled="disabled" />
      </FormField>
    </div>
    <FormField :label="t('informal.expectedFsfLevel')" class="mt-3">
      <select
        v-model="expectedFsfLevel"
        class="w-full rounded-md border border-field-border bg-field-bg px-3 py-2 text-sm"
        :disabled="disabled"
      >
        <option value="semi-formal">{{ t('visual.fsfSemiFormal') }}</option>
        <option value="formal">{{ t('visual.fsfFormal') }}</option>
      </select>
    </FormField>
  </SectionCard>
</template>
