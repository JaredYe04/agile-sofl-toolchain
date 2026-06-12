<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ExtVarItem } from '../../../preload/index'
import SectionCard from './ui/SectionCard.vue'
import FormField from './ui/FormField.vue'
import TextField from './ui/TextField.vue'
import IconButton from './ui/IconButton.vue'
import EmptyState from './ui/EmptyState.vue'
import SelectField from './ui/SelectField.vue'

const props = defineProps<{
  vars: ExtVarItem[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  patch: [vars: ExtVarItem[]]
}>()

const { t } = useI18n()
const drafts = ref<ExtVarItem[]>([])

watch(
  () => props.vars,
  (vars) => {
    drafts.value = vars.map((v) => ({ access: v.access, name: v.name, type: v.type ?? '' }))
  },
  { immediate: true, deep: true }
)

function emitIfChanged(): void {
  if (props.disabled) return
  const same =
    drafts.value.length === props.vars.length &&
    drafts.value.every((d, i) => {
      const o = props.vars[i]
      return o && d.access === o.access && d.name === o.name && (d.type ?? '') === (o.type ?? '')
    })
  if (!same) emit('patch', drafts.value)
}

watch(drafts, emitIfChanged, { deep: true })

function addVar(): void {
  drafts.value.push({ access: 'rd', name: 'var', type: 'nat' })
}

function removeVar(index: number): void {
  drafts.value.splice(index, 1)
}
</script>

<template>
  <SectionCard :title="t('visual.ext.title')">
    <EmptyState v-if="!drafts.length" :message="t('visual.ext.empty')" class="mb-2" />
    <div v-for="(item, index) in drafts" :key="index" class="mb-3 flex flex-wrap items-end gap-2">
      <FormField :label="t('visual.ext.access')" class="w-24">
        <SelectField
          v-model="item.access"
          :disabled="disabled"
          :options="[
            { value: 'rd', label: t('visual.ext.rd') },
            { value: 'wr', label: t('visual.ext.wr') }
          ]"
        />
      </FormField>
      <FormField :label="t('visual.ext.name')" class="min-w-[120px] flex-1">
        <TextField v-model="item.name" mono :disabled="disabled" />
      </FormField>
      <FormField :label="t('visual.ext.type')" class="min-w-[100px] flex-1">
        <TextField v-model="item.type" mono :disabled="disabled" :placeholder="t('visual.ext.typeOptional')" />
      </FormField>
      <IconButton :title="t('visual.ext.remove')" :disabled="disabled" @click="removeVar(index)">×</IconButton>
    </div>
    <button
      type="button"
      class="text-sm text-accent hover:underline disabled:opacity-50"
      :disabled="disabled"
      @click="addVar"
    >
      {{ t('visual.ext.add') }}
    </button>
  </SectionCard>
</template>
