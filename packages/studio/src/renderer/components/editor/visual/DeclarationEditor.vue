<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VisualDeclarationItem } from '../../../preload/index'
import type { DeclarationKind } from '../../../preload/index'

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
    for (const item of items) next[item.name] = item.text
    drafts.value = next
  },
  { immediate: true, deep: true }
)

function isDirty(name: string): boolean {
  const original = props.items.find((i) => i.name === name)?.text ?? ''
  return (drafts.value[name] ?? '') !== original
}

function applyItem(name: string): void {
  emit('patch', { kind: props.kind, action: 'patch', name, text: drafts.value[name] })
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
  <section class="space-y-2">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-medium text-content-secondary">{{ t(sectionLabel[kind]) }}</h3>
      <button
        type="button"
        class="rounded-md px-2 py-0.5 text-xs text-accent hover:bg-accent/10 disabled:opacity-40"
        :disabled="disabled"
        @click="addItem"
      >
        {{ t('visual.addDeclaration') }}
      </button>
    </div>
    <div v-if="!items.length" class="text-sm text-content-secondary">{{ t('visual.noDeclarations') }}</div>
    <div
      v-for="item in items"
      :key="item.name"
      class="flex flex-col gap-1 rounded-lg border border-border-subtle bg-surface-raised p-3"
    >
      <div class="flex items-center justify-between gap-2">
        <button
          type="button"
          class="font-mono text-sm font-medium text-content-primary hover:text-accent"
          @click="emit('revealSpan', item.span)"
        >
          {{ item.name }}
        </button>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded px-2 py-0.5 text-xs text-accent hover:bg-accent/10 disabled:opacity-40"
            :disabled="disabled || !isDirty(item.name)"
            @click="applyItem(item.name)"
          >
            {{ t('visual.apply') }}
          </button>
          <button
            type="button"
            class="rounded px-2 py-0.5 text-xs text-danger hover:bg-danger/10 disabled:opacity-40"
            :disabled="disabled"
            @click="removeItem(item.name)"
          >
            {{ t('visual.remove') }}
          </button>
        </div>
      </div>
      <textarea
        v-model="drafts[item.name]"
        rows="kind === 'type' ? 3 : 1"
        class="w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 font-mono text-sm text-content-primary"
        :disabled="disabled"
        @keydown.ctrl.enter.prevent="applyItem(item.name)"
        @keydown.meta.enter.prevent="applyItem(item.name)"
      />
      <span v-if="isDirty(item.name)" class="text-xs text-accent">{{ t('visual.unsaved') }}</span>
    </div>
  </section>
</template>
