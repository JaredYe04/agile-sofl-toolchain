<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import FieldGroup from '../ui/FieldGroup.vue'
import AddNodeMenu from './AddNodeMenu.vue'
import PredicateNodeView from './PredicateNodeView.vue'
import type { AddNodeKind, PredicateUiNode, SymbolHint } from './predicateTypes'
import type { NodePath } from './predicateTree'

const props = defineProps<{
  node: PredicateUiNode
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

function childPath(i: number): NodePath {
  return [...props.path, i]
}

function onAdd(kind: AddNodeKind): void {
  emit('add-child', props.path, kind)
}

function removeChild(i: number): void {
  emit('remove', childPath(i))
}
</script>

<template>
  <FieldGroup :label="node.kind" class="space-y-2">
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="text-xs text-accent hover:underline disabled:opacity-40"
        :disabled="disabled"
        @click="emit('toggle-and-or', path)"
      >
        {{ t('visual.predicate.toggleAndOr') }}
      </button>
      <button
        type="button"
        class="text-xs text-accent hover:underline disabled:opacity-40"
        :disabled="disabled"
        @click="emit('wrap-not', path)"
      >
        {{ t('visual.predicate.wrapNot') }}
      </button>
      <AddNodeMenu :disabled="disabled" @select="onAdd" />
    </div>
    <div v-for="(child, i) in node.children" :key="i" class="relative ml-3 border-l border-border-subtle pl-3">
      <button
        type="button"
        class="absolute -left-1 top-0 text-xs text-content-muted hover:text-danger disabled:opacity-40"
        :disabled="disabled"
        :title="t('visual.remove')"
        @click="removeChild(i)"
      >
        ×
      </button>
      <button
        type="button"
        class="absolute -left-1 top-5 text-xs text-accent hover:underline disabled:opacity-40"
        :disabled="disabled"
        :title="t('visual.predicate.wrapNot')"
        @click="emit('wrap-not', childPath(i))"
      >
        ¬
      </button>
      <PredicateNodeView
        :node="child"
        :path="childPath(i)"
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
