<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ParamGroupItem } from '../../../preload/index'
import FormField from './ui/FormField.vue'
import TextField from './ui/TextField.vue'
import IconButton from './ui/IconButton.vue'

const props = defineProps<{
  groups: ParamGroupItem[]
  label: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  patch: [groups: ParamGroupItem[]]
}>()

const { t } = useI18n()
const drafts = ref<ParamGroupItem[]>([])

watch(
  () => props.groups,
  (groups) => {
    drafts.value = groups.map((g) => ({ ...g }))
  },
  { immediate: true, deep: true }
)

function emitIfChanged(): void {
  if (props.disabled) return
  const normalized = drafts.value.filter((g) => g.names.trim() || g.type.trim())
  const same =
    normalized.length === props.groups.length &&
    normalized.every((d, i) => {
      const o = props.groups[i]
      return o && d.names === o.names && d.type === o.type
    })
  if (!same) emit('patch', normalized)
}

watch(drafts, emitIfChanged, { deep: true })

function addGroup(): void {
  drafts.value.push({ names: '', type: 'nat' })
}

function removeGroup(index: number): void {
  drafts.value.splice(index, 1)
}
</script>

<template>
  <div>
    <p class="mb-2 text-xs font-medium text-content-secondary">{{ label }}</p>
    <div v-for="(group, index) in drafts" :key="index" class="mb-2 flex flex-wrap items-end gap-2">
      <FormField :label="t('visual.params.names')" class="min-w-[120px] flex-1">
        <TextField v-model="group.names" mono :disabled="disabled" :placeholder="t('visual.params.namesPlaceholder')" />
      </FormField>
      <FormField :label="t('visual.params.type')" class="w-28">
        <TextField v-model="group.type" mono :disabled="disabled" />
      </FormField>
      <IconButton :title="t('visual.params.remove')" :disabled="disabled" @click="removeGroup(index)">×</IconButton>
    </div>
    <button
      type="button"
      class="text-xs text-accent hover:underline disabled:opacity-50"
      :disabled="disabled"
      @click="addGroup"
    >
      {{ t('visual.params.add') }}
    </button>
  </div>
</template>
