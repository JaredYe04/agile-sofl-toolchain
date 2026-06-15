<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { InformalProcessPayload, InformalScenarioPayload } from '../../../../preload/index'
import SectionCard from '../visual/ui/SectionCard.vue'
import FormField from '../visual/ui/FormField.vue'
import TextField from '../visual/ui/TextField.vue'
import InformalScenarioEditor from './InformalScenarioEditor.vue'

const props = defineProps<{
  process: InformalProcessPayload
  moduleId: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  patch: [idPath: string, value: unknown]
  addScenario: []
  removeScenario: [scenarioId: string]
}>()

const { t } = useI18n()
const desc = ref('')
const decom = ref('')
const notes = ref('')
const pre = ref('')
const post = ref('')
const bottomLevel = ref(false)

watch(() => props.process, (p) => {
  desc.value = p.description ?? ''
  decom.value = p.decomposition ?? ''
  notes.value = p.notes ?? ''
  pre.value = p.preconditions ?? ''
  post.value = p.postconditions ?? ''
  bottomLevel.value = p.refinementHints?.bottomLevel ?? false
}, { immediate: true, deep: true })

watch(desc, (v) => {
  if (v !== (props.process.description ?? '')) {
    emit('patch', `process.${props.process.id}.description`, v)
  }
})
watch(decom, (v) => {
  if (v !== (props.process.decomposition ?? '')) {
    emit('patch', `process.${props.process.id}.decomposition`, v)
  }
})
watch(notes, (v) => {
  if (v !== (props.process.notes ?? '')) emit('patch', `process.${props.process.id}.notes`, v)
})
watch(pre, (v) => {
  if (v !== (props.process.preconditions ?? '')) emit('patch', `process.${props.process.id}.preconditions`, v)
})
watch(post, (v) => {
  if (v !== (props.process.postconditions ?? '')) emit('patch', `process.${props.process.id}.postconditions`, v)
})
watch(bottomLevel, (v) => {
  const cur = props.process.refinementHints?.bottomLevel ?? false
  if (v !== cur) {
    emit('patch', `process.${props.process.id}.refinementHints`, {
      ...props.process.refinementHints,
      bottomLevel: v,
      expectedFsfLevel: v ? 'formal' : 'semi-formal'
    })
  }
})

function onScenarioField(id: string, field: 'condition' | 'outcome', value: string): void {
  emit('patch', `scenario.${id}.${field}`, value)
}
</script>

<template>
  <SectionCard :title="process.name">
    <FormField :label="t('informal.processDescription')">
      <TextField v-model="desc" :rows="4" :disabled="disabled" />
    </FormField>
    <FormField :label="t('visual.decom')" class="mt-3">
      <TextField v-model="decom" :rows="1" :disabled="disabled" />
    </FormField>
    <FormField :label="t('informal.preconditions')" class="mt-3">
      <TextField v-model="pre" :rows="2" :disabled="disabled" />
    </FormField>
    <FormField :label="t('informal.postconditions')" class="mt-3">
      <TextField v-model="post" :rows="2" :disabled="disabled" />
    </FormField>
    <FormField :label="t('visual.comment')" class="mt-3">
      <TextField v-model="notes" :rows="2" :disabled="disabled" />
    </FormField>
    <label class="mt-3 flex items-center gap-2 text-xs text-content-secondary">
      <input v-model="bottomLevel" type="checkbox" class="rounded" :disabled="disabled" />
      {{ t('informal.bottomLevel') }}
    </label>
    <div class="mt-4">
      <InformalScenarioEditor
        :scenarios="(process.scenarios ?? []) as InformalScenarioPayload[]"
        :disabled="disabled"
        @update-scenario="onScenarioField"
        @add-scenario="emit('addScenario')"
        @remove-scenario="(id) => emit('removeScenario', id)"
      />
    </div>
  </SectionCard>
</template>
