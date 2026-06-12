<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VisualDeclarationItem, DeclarationKind } from '../../../preload/index'
import SectionCard from './ui/SectionCard.vue'
import TextField from './ui/TextField.vue'
import IconButton from './ui/IconButton.vue'
import EmptyState from './ui/EmptyState.vue'

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

watch(
  () => props.items,
  (items) => {
    const next: Record<string, string> = {}
    for (const item of items) {
      next[item.name] = item.text
    }
    drafts.value = next
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
