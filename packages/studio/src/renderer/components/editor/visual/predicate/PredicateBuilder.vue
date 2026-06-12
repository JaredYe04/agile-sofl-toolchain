<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import CodeField from '../ui/CodeField.vue'
import FormField from '../ui/FormField.vue'
import SectionCard from '../ui/SectionCard.vue'
import PredicateNodeView from './PredicateNodeView.vue'
import AddNodeMenu from './AddNodeMenu.vue'
import type { AddNodeKind, PredicateUiNode, SymbolHint } from './predicateTypes'
import {
  addChildAtPath,
  nodeFromAddKind,
  removeAtPath,
  toggleAndOr,
  wrapNotAtPath,
  unwrapNot,
  type NodePath
} from './predicateTree'

const props = defineProps<{
  modelValue: string
  symbols?: SymbolHint[]
  disabled?: boolean
  label?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'parse-error': [error: string | null]
}>()

const { t } = useI18n()
const mode = ref<'code' | 'visual'>('code')
const codeText = ref(props.modelValue)
const uiRoot = ref<PredicateUiNode | null>(null)
const parseError = ref<string | null>(null)

watch(
  () => props.modelValue,
  (v) => {
    if (v !== codeText.value) {
      codeText.value = v
      void syncFromCode()
    }
  }
)

watch(parseError, (e) => emit('parse-error', e))

async function syncFromCode(): Promise<void> {
  if (!window.studio?.parsePredicateUi) return
  const result = await window.studio.parsePredicateUi(codeText.value)
  uiRoot.value = result.ui as PredicateUiNode | null
  parseError.value = result.error
}

function onCodeInput(value: string): void {
  codeText.value = value
  emit('update:modelValue', value)
  void syncFromCode()
}

async function emitFromUi(): Promise<void> {
  if (!uiRoot.value || !window.studio?.uiToPredicateText) return
  const text = await window.studio.uiToPredicateText(uiRoot.value)
  codeText.value = text
  emit('update:modelValue', text)
  await syncFromCode()
}

async function onUiChange(): Promise<void> {
  await emitFromUi()
}

function onAddChild(path: NodePath, kind: AddNodeKind): void {
  if (!uiRoot.value) return
  const child = nodeFromAddKind(kind)
  uiRoot.value = addChildAtPath(uiRoot.value, path, child)
  void emitFromUi()
}

function onRemove(path: NodePath): void {
  if (!uiRoot.value) return
  uiRoot.value = removeAtPath(uiRoot.value, path) ?? uiRoot.value
  void emitFromUi()
}

function onToggleAndOr(path: NodePath): void {
  if (!uiRoot.value) return
  uiRoot.value = toggleAndOr(uiRoot.value, path)
  void emitFromUi()
}

function onWrapNot(path: NodePath): void {
  if (!uiRoot.value) return
  uiRoot.value = wrapNotAtPath(uiRoot.value, path.length ? path : [])
  void emitFromUi()
}

function onUnwrapNot(path: NodePath): void {
  if (!uiRoot.value) return
  uiRoot.value = unwrapNot(uiRoot.value, path)
  void emitFromUi()
}

function addRootNode(kind: AddNodeKind): void {
  const child = nodeFromAddKind(kind)
  if (!uiRoot.value || uiRoot.value.kind === 'code') {
    uiRoot.value = child
  } else {
    uiRoot.value = addChildAtPath(uiRoot.value, [], child)
  }
  void emitFromUi()
}

function wrapRootNot(): void {
  if (!uiRoot.value) return
  uiRoot.value = { kind: 'not', child: uiRoot.value }
  void emitFromUi()
}

const canVisualize = computed(() => uiRoot.value && uiRoot.value.kind !== 'code')

void syncFromCode()
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between gap-2">
      <label v-if="label" class="text-sm text-content-secondary">{{ label }}</label>
      <div class="flex rounded border border-border-subtle p-0.5 text-xs">
        <button
          type="button"
          class="rounded px-2 py-0.5"
          :class="mode === 'code' ? 'bg-surface-raised text-content-primary' : 'text-content-secondary'"
          @click="mode = 'code'"
        >
          {{ t('visual.predicate.code') }}
        </button>
        <button
          type="button"
          class="rounded px-2 py-0.5"
          :class="mode === 'visual' ? 'bg-surface-raised text-content-primary' : 'text-content-secondary'"
          @click="mode = 'visual'; syncFromCode()"
        >
          {{ t('visual.predicate.visual') }}
        </button>
      </div>
    </div>

    <FormField v-if="mode === 'code'" :error="parseError">
      <CodeField
        :model-value="codeText"
        :symbols="symbols"
        :disabled="disabled"
        :rows="3"
        @update:model-value="onCodeInput"
      />
    </FormField>

    <SectionCard v-else-if="uiRoot && canVisualize" class="!p-3 text-sm">
      <PredicateNodeView
        :node="uiRoot"
        :symbols="symbols"
        :disabled="disabled"
        @change="onUiChange"
        @add-child="onAddChild"
        @remove="onRemove"
        @toggle-and-or="onToggleAndOr"
        @wrap-not="onWrapNot"
        @unwrap-not="onUnwrapNot"
      />
      <div class="mt-3 flex flex-wrap items-center gap-3 border-t border-border-subtle pt-2">
        <AddNodeMenu :disabled="disabled" @select="addRootNode" />
        <button
          type="button"
          class="text-xs text-accent hover:underline disabled:opacity-40"
          :disabled="disabled"
          @click="wrapRootNot"
        >
          {{ t('visual.predicate.wrapNot') }}
        </button>
      </div>
    </SectionCard>
    <p v-else-if="mode === 'visual'" class="text-xs text-content-secondary">{{ t('visual.predicate.parseToVisual') }}</p>
  </div>
</template>
