<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VisualDeclarationItem, DeclarationKind } from '../../../preload/index'
import SectionCard from './ui/SectionCard.vue'
import TextField from './ui/TextField.vue'
import IconButton from './ui/IconButton.vue'
import EmptyState from './ui/EmptyState.vue'

const BASIC_TYPES = ['nat', 'nat0', 'int', 'real', 'bool', 'string', 'char']

const props = defineProps<{
  kind: DeclarationKind
  items: VisualDeclarationItem[]
  moduleName: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  patch: [payload: { kind: DeclarationKind; action: 'patch' | 'add' | 'remove'; name?: string; text?: string }]
  revealSpan: [span: VisualDeclarationItem['span']]
}>()

const { t } = useI18n()
const drafts = ref<Record<string, string>>({})
const fieldDrafts = ref<Record<string, Array<{ name: string; type: string }>>>({})

watch(
  () => props.items,
  (items) => {
    const next: Record<string, string> = {}
    const fields: Record<string, Array<{ name: string; type: string }>> = {}
    for (const item of items) {
      next[item.name] = item.text
      if (item.fields?.length) fields[item.name] = item.fields.map((f) => ({ ...f }))
    }
    drafts.value = next
    fieldDrafts.value = fields
  },
  { immediate: true, deep: true }
)

watch(
  drafts,
  (next) => {
    if (props.disabled) return
    for (const item of props.items) {
      const text = next[item.name] ?? ''
      if (text !== item.text) {
        emit('patch', { kind: props.kind, action: 'patch', name: item.name, text })
      }
    }
  },
  { deep: true }
)

function composedText(name: string, fields: Array<{ name: string; type: string }>): string {
  return `${name} = composed of ${fields.map((f) => `${f.name}: ${f.type}`).join(' ')} end`
}

function onFieldChange(itemName: string): void {
  const fields = fieldDrafts.value[itemName]
  if (!fields) return
  drafts.value = { ...drafts.value, [itemName]: composedText(itemName, fields) }
}

function addField(itemName: string): void {
  const current = fieldDrafts.value[itemName] ?? []
  fieldDrafts.value = {
    ...fieldDrafts.value,
    [itemName]: [...current, { name: `field_${current.length + 1}`, type: 'nat' }]
  }
  onFieldChange(itemName)
}

function removeField(itemName: string, index: number): void {
  const current = [...(fieldDrafts.value[itemName] ?? [])]
  current.splice(index, 1)
  fieldDrafts.value = { ...fieldDrafts.value, [itemName]: current }
  onFieldChange(itemName)
}

function removeItem(name: string): void {
  emit('patch', { kind: props.kind, action: 'remove', name })
}

function addItem(): void {
  const defaults: Record<DeclarationKind, string> = {
    const: 'NewConst = 0',
    type: 'NewType = nat',
    var: 'newVar: nat'
  }
  emit('patch', { kind: props.kind, action: 'add', text: defaults[props.kind] })
}

const sectionLabel = {
  const: 'visual.section.const',
  type: 'visual.section.type',
  var: 'visual.section.var'
} as const
</script>

<template>
  <SectionCard>
    <template #title>
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-content-primary">{{ t(sectionLabel[kind]) }}</h3>
        <button
          type="button"
          class="rounded-md px-2 py-0.5 text-xs text-accent hover:bg-accent/10 disabled:opacity-40"
          :disabled="disabled"
          @click="addItem"
        >
          {{ t('visual.addDeclaration') }}
        </button>
      </div>
    </template>

    <EmptyState v-if="!items.length" :message="t('visual.noDeclarations')" />

    <div v-else class="space-y-2">
      <div
        v-for="item in items"
        :key="item.name"
        class="rounded-md border border-border-subtle bg-surface-base p-3"
      >
        <div class="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            class="font-mono text-sm font-medium text-content-primary hover:text-accent"
            @click="emit('revealSpan', item.span)"
          >
            {{ item.name }}
          </button>
          <IconButton variant="danger" :disabled="disabled" @click="removeItem(item.name)">
            {{ t('visual.remove') }}
          </IconButton>
        </div>
        <table
          v-if="kind === 'type' && fieldDrafts[item.name]?.length"
          class="mb-2 w-full text-left text-[12px]"
        >
          <thead>
            <tr class="text-content-muted">
              <th class="py-1 pr-2 font-medium">{{ t('visual.typeField') }}</th>
              <th class="py-1 pr-2 font-medium">{{ t('visual.typeFieldType') }}</th>
              <th class="w-8" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(field, fi) in fieldDrafts[item.name]" :key="`${item.name}-${fi}`">
              <td class="py-1 pr-2">
                <input
                  v-model="field.name"
                  class="visual-field w-full px-2 py-1 font-mono"
                  :disabled="disabled"
                  @change="onFieldChange(item.name)"
                />
              </td>
              <td class="py-1 pr-2">
                <select
                  v-model="field.type"
                  class="visual-field w-full px-2 py-1"
                  :disabled="disabled"
                  @change="onFieldChange(item.name)"
                >
                  <option v-for="ty in BASIC_TYPES" :key="ty" :value="ty">{{ ty }}</option>
                  <option v-if="!BASIC_TYPES.includes(field.type)" :value="field.type">{{ field.type }}</option>
                </select>
              </td>
              <td>
                <IconButton variant="danger" :disabled="disabled" @click="removeField(item.name, fi)">
                  {{ t('visual.remove') }}
                </IconButton>
              </td>
            </tr>
          </tbody>
        </table>
        <button
          v-if="kind === 'type'"
          type="button"
          class="mb-2 text-[11px] text-accent hover:underline disabled:opacity-40"
          :disabled="disabled"
          @click="addField(item.name)"
        >
          {{ t('visual.addField') }}
        </button>
        <TextField
          v-model="drafts[item.name]"
          :rows="kind === 'type' ? 3 : 1"
          mono
          :disabled="disabled"
        />
      </div>
    </div>
  </SectionCard>
</template>
