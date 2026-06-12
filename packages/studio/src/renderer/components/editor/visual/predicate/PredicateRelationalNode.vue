<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import CodeField from '../ui/CodeField.vue'
import SelectField from '../ui/SelectField.vue'
import FieldGroup from '../ui/FieldGroup.vue'
import type { PredicateUiNode, SymbolHint } from './predicateTypes'
import type { NodePath } from './predicateTree'

const props = defineProps<{
  node: Extract<PredicateUiNode, { kind: 'relational' }>
  path: NodePath
  symbols?: SymbolHint[]
  disabled?: boolean
}>()

const emit = defineEmits<{ change: []; 'wrap-not': [path: NodePath] }>()
const { t } = useI18n()

const ops = ['=', '<>', '<', '<=', '>', '>=', 'inset', 'notin']

const textPreview = computed(() => {
  if (props.node.left && props.node.op && props.node.right) {
    return `${props.node.left} ${props.node.op} ${props.node.right}`
  }
  return props.node.text
})

function sync(): void {
  if (props.node.left && props.node.op && props.node.right) {
    props.node.text = `${props.node.left} ${props.node.op} ${props.node.right}`
  }
  emit('change')
}

function onLeft(v: string): void {
  props.node.left = v
  sync()
}

function onOp(v: string): void {
  props.node.op = v
  sync()
}

function onRight(v: string): void {
  props.node.right = v
  sync()
}
</script>

<template>
  <FieldGroup :label="t('visual.predicate.relational')" class="space-y-2">
    <div class="flex justify-end">
      <button
        type="button"
        class="text-xs text-accent hover:underline disabled:opacity-40"
        :disabled="disabled"
        @click="emit('wrap-not', path)"
      >
        {{ t('visual.predicate.wrapNot') }}
      </button>
    </div>
    <div class="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
      <CodeField
        :model-value="node.left"
        :symbols="symbols"
        :disabled="disabled"
        :rows="1"
        :bordered="false"
        @update:model-value="onLeft"
      />
      <SelectField
        :model-value="node.op"
        :disabled="disabled"
        :options="ops.map((op) => ({ value: op, label: op }))"
        @update:model-value="onOp"
      />
      <CodeField
        :model-value="node.right"
        :symbols="symbols"
        :disabled="disabled"
        :rows="1"
        :bordered="false"
        @update:model-value="onRight"
      />
    </div>
    <p v-if="textPreview" class="font-mono text-xs text-content-secondary">{{ textPreview }}</p>
  </FieldGroup>
</template>
