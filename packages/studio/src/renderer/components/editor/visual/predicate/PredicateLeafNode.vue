<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CodeField from '../ui/CodeField.vue'
import SelectField from '../ui/SelectField.vue'
import FieldGroup from '../ui/FieldGroup.vue'
import type { PredicateUiNode, SymbolHint } from './predicateTypes'
import type { NodePath } from './predicateTree'

const props = defineProps<{
  node: Extract<PredicateUiNode, { kind: 'informal' | 'expr' | 'literal' }>
  path: NodePath
  symbols?: SymbolHint[]
  disabled?: boolean
}>()

const emit = defineEmits<{ change: []; 'wrap-not': [path: NodePath] }>()
const { t } = useI18n()

function leafText(): string {
  if (props.node.kind === 'literal') return props.node.value
  return props.node.text
}

function onText(value: string): void {
  if (props.node.kind === 'literal') {
    props.node.value = value === 'false' ? 'false' : 'true'
  } else {
    props.node.text = value
  }
  emit('change')
}
</script>

<template>
  <FieldGroup class="space-y-1">
    <div class="flex items-center gap-2">
      <p v-if="node.kind !== 'literal'" class="text-xs text-content-muted">
        {{ node.kind === 'informal' ? t('visual.predicate.informal') : t('visual.predicate.expr') }}
      </p>
      <button
        type="button"
        class="ml-auto text-xs text-accent hover:underline disabled:opacity-40"
        :disabled="disabled"
        @click="emit('wrap-not', path)"
      >
        {{ t('visual.predicate.wrapNot') }}
      </button>
    </div>
    <CodeField
      v-if="node.kind !== 'literal'"
      :model-value="leafText()"
      :symbols="symbols"
      :disabled="disabled"
      :rows="2"
      :bordered="false"
      @update:model-value="onText"
    />
    <SelectField
      v-else
      :model-value="node.value"
      :disabled="disabled"
      :options="[
        { value: 'true', label: 'true' },
        { value: 'false', label: 'false' }
      ]"
      @update:model-value="onText"
    />
  </FieldGroup>
</template>
