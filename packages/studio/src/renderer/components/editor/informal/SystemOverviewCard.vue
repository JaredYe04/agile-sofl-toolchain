<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SectionCard from '../visual/ui/SectionCard.vue'
import FormField from '../visual/ui/FormField.vue'
import TextField from '../visual/ui/TextField.vue'

export type GlossaryEntry = { term: string; definition: string }

const props = defineProps<{
  purpose: string
  scope?: string
  assumptions?: string
  stakeholders?: string[]
  glossary?: GlossaryEntry[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  patchPurpose: [v: string]
  patchScope: [v: string]
  patchAssumptions: [v: string]
  patchStakeholders: [v: string]
  patchGlossary: [v: GlossaryEntry[]]
}>()

const { t } = useI18n()
const purposeDraft = ref('')
const scopeDraft = ref('')
const assumptionsDraft = ref('')
const stakeholdersDraft = ref('')
const glossaryDraft = ref<GlossaryEntry[]>([])

watch(
  () => props,
  (p) => {
    purposeDraft.value = p.purpose
    scopeDraft.value = p.scope ?? ''
    assumptionsDraft.value = p.assumptions ?? ''
    stakeholdersDraft.value = (p.stakeholders ?? []).join(', ')
    glossaryDraft.value = (p.glossary ?? []).map((g) => ({ ...g }))
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

function emitGlossary(): void {
  emit('patchGlossary', glossaryDraft.value)
}

function addGlossaryEntry(): void {
  glossaryDraft.value.push({ term: '', definition: '' })
  emitGlossary()
}

function removeGlossaryEntry(index: number): void {
  glossaryDraft.value.splice(index, 1)
  emitGlossary()
}

function patchGlossaryEntry(index: number, field: 'term' | 'definition', value: string): void {
  const entry = glossaryDraft.value[index]
  if (!entry) return
  entry[field] = value
  emitGlossary()
}
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
    <div class="mt-4">
      <div class="mb-1 flex items-center justify-between">
        <p class="text-xs font-medium text-content-secondary">{{ t('informal.glossary') }}</p>
        <button type="button" class="text-xs text-accent hover:underline disabled:opacity-40" :disabled="disabled" @click="addGlossaryEntry">
          {{ t('informal.addEntry') }}
        </button>
      </div>
      <ul class="space-y-2">
        <li v-for="(entry, index) in glossaryDraft" :key="index" class="flex items-start gap-2 rounded border border-border-subtle p-2">
          <div class="min-w-0 flex-1 space-y-1">
            <TextField
              :model-value="entry.term"
              :placeholder="t('informal.glossaryTerm')"
              :disabled="disabled"
              @update:model-value="(v) => patchGlossaryEntry(index, 'term', v)"
            />
            <TextField
              :model-value="entry.definition"
              :rows="2"
              :placeholder="t('informal.glossaryDefinition')"
              :disabled="disabled"
              @update:model-value="(v) => patchGlossaryEntry(index, 'definition', v)"
            />
          </div>
          <button type="button" class="text-xs text-semantic-error hover:underline" :disabled="disabled" @click="removeGlossaryEntry(index)">×</button>
        </li>
      </ul>
    </div>
  </SectionCard>
</template>
