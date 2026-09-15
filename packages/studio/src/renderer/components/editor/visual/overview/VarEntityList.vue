<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VisualDeclarationItem } from '../../../../preload/index'
import { BASIC_TYPES, parseVarText, varDeclText } from '../../../../lib/visualDecls'
import EmptyState from '../ui/EmptyState.vue'
import FormField from '../ui/FormField.vue'
import TextField from '../ui/TextField.vue'
import VisualEditDialog from './VisualEditDialog.vue'
import VisualEntityMenu from './VisualEntityMenu.vue'

const props = defineProps<{
  items: VisualDeclarationItem[]
  typeNames?: string[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  patch: [payload: { action: 'patch' | 'remove'; name: string; text?: string }]
}>()

const { t } = useI18n()
const editing = ref<VisualDeclarationItem | null>(null)
const draftName = ref('')
const draftType = ref('nat')

const parsed = computed(() =>
  props.items.map((item) => {
    const { name, type } = parseVarText(item.text)
    return { item, name: name || item.name, type }
  })
)

const typeOptions = computed(() => {
  const extra = (props.typeNames ?? []).filter((ty) => !BASIC_TYPES.includes(ty))
  const all = [...BASIC_TYPES, ...extra]
  if (draftType.value && !all.includes(draftType.value)) all.push(draftType.value)
  return all
})

function openEdit(item: VisualDeclarationItem): void {
  const parsedItem = parseVarText(item.text)
  editing.value = item
  draftName.value = parsedItem.name || item.name
  draftType.value = parsedItem.type || 'nat'
}

function confirmEdit(): void {
  const item = editing.value
  if (!item || !draftName.value.trim()) return
  emit('patch', { action: 'patch', name: item.name, text: varDeclText(draftName.value, draftType.value) })
  editing.value = null
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <h3 class="mb-2 text-sm font-semibold text-content-primary">{{ t('visual.section.var') }}</h3>
    <EmptyState v-if="!items.length" :message="t('visual.noDeclarations')" />
    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="row in parsed"
        :key="row.item.name"
        class="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 transition-colors hover:border-accent/30"
      >
        <div class="min-w-0 flex-1">
          <p class="truncate font-mono text-sm font-medium text-content-primary">{{ row.name }}</p>
          <p class="truncate font-mono text-[11px] text-content-muted">{{ row.type }}</p>
        </div>
        <VisualEntityMenu
          :disabled="disabled"
          @edit="openEdit(row.item)"
          @remove="emit('patch', { action: 'remove', name: row.item.name })"
        />
      </li>
    </ul>
  </div>

  <VisualEditDialog
    :open="Boolean(editing)"
    :title="t('visual.var.editTitle')"
    @close="editing = null"
    @confirm="confirmEdit"
  >
    <div class="space-y-3">
      <FormField :label="t('visual.var.name')">
        <TextField v-model="draftName" mono :disabled="disabled" />
      </FormField>
      <FormField :label="t('visual.var.type')">
        <select
          v-model="draftType"
          class="visual-field w-full px-3 py-2 text-sm"
          :disabled="disabled"
        >
          <option v-for="ty in typeOptions" :key="ty" :value="ty">{{ ty }}</option>
        </select>
      </FormField>
    </div>
  </VisualEditDialog>
</template>
