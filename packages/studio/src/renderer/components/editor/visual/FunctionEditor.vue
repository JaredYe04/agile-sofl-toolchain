<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VisualFunctionItem } from '../../../preload/index'
import type { FsfModelDto } from './FsfScenarioEditor.vue'
import FsfScenarioEditor from './FsfScenarioEditor.vue'
import SignatureEditor from './SignatureEditor.vue'
import SectionCard from './ui/SectionCard.vue'
import FormField from './ui/FormField.vue'
import TextField from './ui/TextField.vue'
import Badge from './ui/Badge.vue'
import InlineRename from './ui/InlineRename.vue'
import type { SymbolHint } from './predicate/predicateTypes'

const props = defineProps<{
  fn: VisualFunctionItem
  moduleName: string
  fsfModel: FsfModelDto | null
  symbols?: SymbolHint[]
  disabled?: boolean
  writeDisabledReason?: 'parseFailed' | 'diagnostics' | null
}>()

const emit = defineEmits<{
  patch: [payload: { body?: string; fsf?: { scenarios: FsfModelDto['scenarios']; others?: string } }]
  patchSignature: [signature: string]
  rename: [name: string]
  revealSpan: [span: VisualFunctionItem['span']]
}>()

const { t } = useI18n()
const bodyText = ref('')
const fsfRef = ref<InstanceType<typeof FsfScenarioEditor> | null>(null)
const renaming = ref(false)

watch(
  () => props.fn.body ?? '',
  (body) => {
    bodyText.value = body
  },
  { immediate: true }
)

watch(bodyText, (text) => {
  if (props.disabled) return
  if (text === (props.fn.body ?? '')) return
  emit('patch', { body: text })
})

function onFsfPatch(scenarios: FsfModelDto['scenarios'], others?: string): void {
  emit('patch', { fsf: { scenarios, others } })
}

defineExpose({
  addScenario() {
    fsfRef.value?.addScenario()
  }
})

const disabledMessage = () => {
  if (props.writeDisabledReason === 'parseFailed') return t('visual.writeDisabledParseFailed')
  if (props.writeDisabledReason === 'diagnostics') return t('visual.writeDisabledDiagnostics')
  return t('visual.writeDisabled')
}
</script>

<template>
  <div class="visual-panel space-y-4 p-4">
    <header class="flex items-center justify-between gap-2">
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <h2 class="flex min-w-0 items-center gap-2 text-lg font-semibold text-content-primary">
          <span class="shrink-0">{{ t('visual.function') }}</span>
          <InlineRename
            :model-value="fn.name"
            :editing="renaming"
            :disabled="disabled"
            @update:editing="renaming = $event"
            @commit="emit('rename', $event)"
          />
        </h2>
        <Badge variant="function">{{ t('visual.nodeRole.function') }}</Badge>
        <Badge v-if="fn.fsfFormal === 'formal'" variant="formal">{{ t('visual.fsfFormal') }}</Badge>
        <Badge v-else-if="fn.fsfFormal === 'semi-formal'" variant="semi-formal">{{ t('visual.fsfSemiFormal') }}</Badge>
      </div>
      <button
        type="button"
        class="shrink-0 text-xs text-accent hover:underline"
        @click="emit('revealSpan', fn.span)"
      >
        {{ t('visual.context.revealInCode') }}
      </button>
    </header>

    <div
      v-if="disabled"
      class="rounded-md border border-semantic-warning/40 bg-semantic-warning/10 px-3 py-2 text-sm text-semantic-warning"
    >
      {{ disabledMessage() }}
    </div>

    <SectionCard>
      <SignatureEditor
        :signature="fn.signature ?? '()'"
        :params="fn.params"
        :return-type="fn.returnType"
        kind="function"
        :disabled="disabled"
        @patch="emit('patchSignature', $event)"
      />
      <FormField :label="t('visual.functionBody')" class="mt-4">
        <TextField v-model="bodyText" :rows="4" mono :disabled="disabled" />
      </FormField>
    </SectionCard>

    <FsfScenarioEditor
      v-if="fsfModel"
      ref="fsfRef"
      :model="fsfModel"
      :symbols="symbols"
      :disabled="disabled"
      @save="onFsfPatch"
    />
    <p v-else-if="fn.hasFsf === false" class="text-sm text-content-secondary">{{ t('visual.noFsf') }}</p>
  </div>
</template>
