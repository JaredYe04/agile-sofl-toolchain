<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import FieldGroup from '../ui/FieldGroup.vue'
import PredicateAndOrNode from './PredicateAndOrNode.vue'
import PredicateQuantifiedNode from './PredicateQuantifiedNode.vue'
import PredicateRelationalNode from './PredicateRelationalNode.vue'
import PredicateLeafNode from './PredicateLeafNode.vue'
import type { AddNodeKind, PredicateUiNode, SymbolHint } from './predicateTypes'
import type { NodePath } from './predicateTree'

defineOptions({ name: 'PredicateNodeView' })

defineProps<{
  node: PredicateUiNode
  path?: NodePath
  symbols?: SymbolHint[]
  disabled?: boolean
  blockInformal?: boolean
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

function pathOrEmpty(p: NodePath | undefined): NodePath {
  return p ?? []
}
</script>

<template>
  <PredicateAndOrNode
    v-if="node.kind === 'and' || node.kind === 'or'"
    :node="node"
    :path="pathOrEmpty(path)"
    :symbols="symbols"
    :disabled="disabled"
    :block-informal="blockInformal"
    @change="emit('change')"
    @add-child="(p, k) => emit('add-child', p, k)"
    @remove="(p) => emit('remove', p)"
    @toggle-and-or="(p) => emit('toggle-and-or', p)"
    @wrap-not="(p) => emit('wrap-not', p)"
    @unwrap-not="(p) => emit('unwrap-not', p)"
  />
  <FieldGroup v-else-if="node.kind === 'not'" label="not" class="relative ml-1">
    <div class="mb-1 flex items-center gap-2">
      <button
        type="button"
        class="text-xs text-accent hover:underline disabled:opacity-40"
        :disabled="disabled"
        @click="emit('unwrap-not', pathOrEmpty(path))"
      >
        {{ t('visual.predicate.unwrapNot') }}
      </button>
    </div>
    <PredicateNodeView
      :node="node.child"
      :path="[...(path ?? []), 0]"
      :symbols="symbols"
      :disabled="disabled"
      @change="emit('change')"
      @add-child="(p, k) => emit('add-child', p, k)"
      @remove="(p) => emit('remove', p)"
      @toggle-and-or="(p) => emit('toggle-and-or', p)"
      @wrap-not="(p) => emit('wrap-not', p)"
      @unwrap-not="(p) => emit('unwrap-not', p)"
    />
  </FieldGroup>
  <PredicateQuantifiedNode
    v-else-if="node.kind === 'quantified'"
    :node="node"
    :path="pathOrEmpty(path)"
    :symbols="symbols"
    :disabled="disabled"
    @change="emit('change')"
    @add-child="(p, k) => emit('add-child', p, k)"
    @remove="(p) => emit('remove', p)"
    @toggle-and-or="(p) => emit('toggle-and-or', p)"
    @wrap-not="(p) => emit('wrap-not', p)"
    @unwrap-not="(p) => emit('unwrap-not', p)"
  />
  <PredicateRelationalNode
    v-else-if="node.kind === 'relational'"
    :node="node"
    :path="pathOrEmpty(path)"
    :symbols="symbols"
    :disabled="disabled"
    @change="emit('change')"
    @wrap-not="(p) => emit('wrap-not', p)"
  />
  <PredicateLeafNode
    v-else-if="node.kind === 'informal' || node.kind === 'expr' || node.kind === 'literal'"
    :node="node"
    :path="pathOrEmpty(path)"
    :symbols="symbols"
    :disabled="disabled"
    @change="emit('change')"
    @wrap-not="(p) => emit('wrap-not', p)"
  />
  <p v-else class="font-mono text-xs text-content-secondary">{{ node.kind === 'code' ? node.text : '' }}</p>
</template>
