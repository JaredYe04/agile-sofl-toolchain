<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CodeField from '../ui/CodeField.vue'
import SelectField from '../ui/SelectField.vue'
import FieldGroup from '../ui/FieldGroup.vue'
import PredicateNodeView from './PredicateNodeView.vue'
import type { AddNodeKind, PredicateUiNode, SymbolHint } from './predicateTypes'
import type { NodePath } from './predicateTree'
const props = defineProps<{
  node: Extract<PredicateUiNode, { kind: 'quantified' }>
  path: NodePath
  symbols?: SymbolHint[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  change: []
  'add-child': [path: NodePath, kind: AddNodeKind]
  remove: [path: NodePath]
  'toggle-and-or': [path: NodePath]
  'wrap-not': [path: NodePath]
  'unwrap-not': [path: NodePath]
}>()
const { t } = useI18n()

const quantOptions = [
  { value: 'forall', label: 'forall' },
  { value: 'exists', label: 'exists' },
  { value: 'exists_unique', label: 'exists!' }
] as const

function bodyPath(): NodePath {
  return [...props.path, 0]
}

function onQuantifier(value: string): void {
  props.node.quantifier = value as typeof props.node.quantifier
  emit('change')
}

function onBindings(value: string): void {
  props.node.bindings = value
  emit('change')
}

function onNested(value: string): void {
  props.node.nested = value
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  emit('change')
}
</script>

<template>
  <FieldGroup class="space-y-2">
    <div class="flex flex-wrap items-center gap-2 text-xs">
      <SelectField
        :model-value="node.quantifier"
        size="sm"
        :disabled="disabled"
        :options="quantOptions.map((q) => ({ value: q.value, label: q.label }))"
        @update:model-value="onQuantifier"
      />
      <button
        type="button"
        class="text-xs text-accent hover:underline disabled:opacity-40"
        :disabled="disabled"
        @click="emit('wrap-not', path)"
      >
        {{ t('visual.predicate.wrapNot') }}
      </button>
    </div>
    <div class="flex flex-wrap items-center gap-2 text-xs">
      <span class="text-content-muted">[</span>
      <CodeField
        :model-value="node.bindings"
        :symbols="symbols"
        :disabled="disabled"
        :rows="1"
        :bordered="false"
        class="min-w-[8rem] flex-1"
        @update:model-value="onBindings"
      />
      <span class="text-content-muted">]</span>
    </div>
    <div v-if="node.nested.length" class="text-xs">
      <label class="text-content-muted">{{ t('visual.predicate.nestedQuantifiers') }}</label>
      <CodeField
        :model-value="node.nested.join(' ')"
        :disabled="disabled"
        :rows="1"
        :bordered="false"
        @update:model-value="onNested"
      />
    </div>
    <div class="ml-3 border-l border-border-subtle pl-3">
      <span class="text-xs text-content-muted">|</span>
      <PredicateNodeView
        :node="node.body"
        :path="bodyPath()"
        :symbols="symbols"
        :disabled="disabled"
        @change="emit('change')"
        @add-child="(p, k) => emit('add-child', p, k)"
        @remove="(p) => emit('remove', p)"
        @toggle-and-or="(p) => emit('toggle-and-or', p)"
        @wrap-not="(p) => emit('wrap-not', p)"
        @unwrap-not="(p) => emit('unwrap-not', p)"
      />
    </div>
  </FieldGroup>
</template>
