<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VisualDeclarationItem } from '../../../../preload/index'
import {
  BASIC_TYPES,
  composedTypeText,
  nextFieldName,
  type TypeFieldDraft,
  typeExpressionOf
} from '../../../../lib/visualDecls'
import EmptyState from '../ui/EmptyState.vue'
import SectionCard from '../ui/SectionCard.vue'
import FormField from '../ui/FormField.vue'
import TextField from '../ui/TextField.vue'
import TypeClassCard from './TypeClassCard.vue'
import TypeFieldForm from './TypeFieldForm.vue'
import VisualEditDialog from './VisualEditDialog.vue'
import IconActionButton from '../../../ui/IconActionButton.vue'

const props = defineProps<{
  items: VisualDeclarationItem[]
  extraTypes?: string[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  patch: [payload: { action: 'patch' | 'remove'; name: string; text?: string }]
}>()

const { t } = useI18n()

const editing = ref<VisualDeclarationItem | null>(null)
const editName = ref('')
const editFields = ref<TypeFieldDraft[]>([])
const editAlias = ref('')
const editAsComposed = ref(true)
const addingTo = ref<VisualDeclarationItem | null>(null)
const newField = ref<TypeFieldDraft>({ name: 'field_1', type: 'nat' })

const extraTypes = computed(() => [
  ...(props.extraTypes ?? []),
  ...props.items.map((i) => i.name)
])

function openEdit(item: VisualDeclarationItem): void {
  editing.value = item
  editName.value = item.name
  const fields = item.fields?.map((f) => ({ ...f })) ?? []
  editAsComposed.value = fields.length > 0 || /composed of/i.test(item.text)
  editFields.value = fields.length ? fields : [{ name: nextFieldName([]), type: 'nat' }]
  editAlias.value = typeExpressionOf(item.text).replace(/^composed of[\s\S]*$/i, '').trim() || 'nat'
}

function confirmEdit(): void {
  const item = editing.value
  if (!item || !editName.value.trim()) return
  const text = editAsComposed.value
    ? composedTypeText(editName.value, editFields.value)
    : `${editName.value.trim()} = ${editAlias.value.trim() || 'nat'}`
  emit('patch', { action: 'patch', name: item.name, text })
  editing.value = null
}

function openAddField(item: VisualDeclarationItem): void {
  addingTo.value = item
  newField.value = { name: nextFieldName(item.fields ?? []), type: 'nat' }
}

function confirmAddField(): void {
  const item = addingTo.value
  if (!item || !newField.value.name.trim()) return
  const fields = [...(item.fields ?? []).map((f) => ({ ...f })), { ...newField.value }]
  emit('patch', { action: 'patch', name: item.name, text: composedTypeText(item.name, fields) })
  addingTo.value = null
}

function addEditField(): void {
  editFields.value = [...editFields.value, { name: nextFieldName(editFields.value), type: 'nat' }]
}

function updateEditField(index: number, field: TypeFieldDraft): void {
  const next = [...editFields.value]
  next[index] = field
  editFields.value = next
}

function removeEditField(index: number): void {
  editFields.value = editFields.value.filter((_, i) => i !== index)
}

function typeOptions(): string[] {
  return [...new Set([...BASIC_TYPES, ...extraTypes.value])]
}
</script>

<template>
  <SectionCard>
    <template #title>
      <h3 class="text-sm font-semibold text-content-primary">{{ t('visual.section.type') }}</h3>
    </template>
    <EmptyState v-if="!items.length" :message="t('visual.noDeclarations')" />
    <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <TypeClassCard
        v-for="item in items"
        :key="item.name"
        :item="item"
        :disabled="disabled"
        @edit="openEdit(item)"
        @remove="emit('patch', { action: 'remove', name: item.name })"
        @add-field="openAddField(item)"
      />
    </div>
  </SectionCard>

  <VisualEditDialog
    :open="Boolean(editing)"
    :title="t('visual.type.editTitle')"
    @close="editing = null"
    @confirm="confirmEdit"
  >
    <div class="space-y-4">
      <FormField :label="t('visual.type.name')">
        <TextField v-model="editName" mono :disabled="disabled" />
      </FormField>
      <label class="flex items-center gap-2 text-sm text-content-primary">
        <input v-model="editAsComposed" type="checkbox" class="rounded border-border-subtle" :disabled="disabled" />
        {{ t('visual.type.composed') }}
      </label>
      <template v-if="editAsComposed">
        <div v-for="(field, i) in editFields" :key="i" class="rounded-lg border border-border-subtle p-3">
          <TypeFieldForm
            :field="field"
            :extra-types="typeOptions()"
            :disabled="disabled"
            @update:field="updateEditField(i, $event)"
          />
          <IconActionButton
            class="mt-2"
            icon="lucide:trash-2"
            :label="t('visual.remove')"
            variant="danger"
            :disabled="disabled || editFields.length < 2"
            @click="removeEditField(i)"
          />
        </div>
        <button type="button" class="text-[12px] text-accent hover:underline" :disabled="disabled" @click="addEditField">
          {{ t('visual.addField') }}
        </button>
      </template>
      <FormField v-else :label="t('visual.type.expression')">
        <TextField v-model="editAlias" mono :disabled="disabled" />
      </FormField>
    </div>
  </VisualEditDialog>

  <VisualEditDialog
    :open="Boolean(addingTo)"
    :title="t('visual.type.addFieldTitle')"
    @close="addingTo = null"
    @confirm="confirmAddField"
  >
    <TypeFieldForm
      :field="newField"
      :extra-types="typeOptions()"
      :disabled="disabled"
      @update:field="newField = $event"
    />
  </VisualEditDialog>
</template>
