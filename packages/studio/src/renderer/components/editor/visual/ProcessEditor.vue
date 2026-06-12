<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ExtVarItem, PatchDocumentPayload, VisualModuleProcess } from '../../../preload/index'
import type { FsfModelDto } from './FsfScenarioEditor.vue'
import FsfScenarioEditor from './FsfScenarioEditor.vue'
import ExtBlockEditor from './ExtBlockEditor.vue'
import SignatureEditor from './SignatureEditor.vue'
import SectionCard from './ui/SectionCard.vue'
import FormField from './ui/FormField.vue'
import TextField from './ui/TextField.vue'
import Badge from './ui/Badge.vue'
import InlineRename from './ui/InlineRename.vue'

const props = defineProps<{
  process: VisualModuleProcess
  processName: string
  moduleName: string
  initialDecom?: string
  initialComment?: string
  fsfModel: FsfModelDto | null
  disabled?: boolean
  writeDisabledReason?: 'parseFailed' | 'diagnostics' | null
  symbols?: import('./predicate/predicateTypes').SymbolHint[]
}>()

const emit = defineEmits<{
  patch: [payload: Omit<PatchDocumentPayload, 'source'>]
  patchExt: [vars: ExtVarItem[]]
  patchSignature: [signature: string]
  patchInit: [isInit: boolean]
  rename: [name: string]
}>()

const isInitDraft = ref(false)

watch(
  () => props.process.isInit,
  (init) => {
    isInitDraft.value = Boolean(init)
  },
  { immediate: true }
)

watch(isInitDraft, (init) => {
  if (props.disabled) return
  if (init === Boolean(props.process.isInit)) return
  emit('patchInit', init)
})

const { t } = useI18n()
const fsfRef = ref<InstanceType<typeof FsfScenarioEditor> | null>(null)
const renaming = ref(false)

defineExpose({
  addScenario() {
    fsfRef.value?.addScenario()
  }
})

function stripFieldPrefix(text: string, prefix: string): string {
  const trimmed = text.trim()
  if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
    return trimmed.slice(prefix.length).trim()
  }
  return trimmed
}

const decomText = ref('')
const commentText = ref('')

watch(
  () => [props.initialDecom, props.initialComment] as const,
  ([decom, comment]) => {
    decomText.value = stripFieldPrefix(decom ?? '', 'decom:')
    commentText.value = stripFieldPrefix(comment ?? '', 'comment:')
  },
  { immediate: true }
)

watch(decomText, (text) => {
  if (props.disabled) return
  const original = stripFieldPrefix(props.initialDecom ?? '', 'decom:')
  if (text === original) return
  emit('patch', { kind: 'decom', processName: props.processName, text })
})

watch(commentText, (text) => {
  if (props.disabled) return
  const original = stripFieldPrefix(props.initialComment ?? '', 'comment:')
  if (text === original) return
  emit('patch', { kind: 'comment', processName: props.processName, text })
})

function onFsfPatch(scenarios: FsfModelDto['scenarios'], others?: string): void {
  emit('patch', { kind: 'fsf', processName: props.processName, scenarios, others })
}

const disabledMessage = () => {
  if (props.writeDisabledReason === 'parseFailed') return t('visual.writeDisabledParseFailed')
  if (props.writeDisabledReason === 'diagnostics') return t('visual.writeDisabledDiagnostics')
  return t('visual.writeDisabled')
}
</script>

<template>
  <div class="visual-panel space-y-4 p-4">
    <header class="flex flex-wrap items-center gap-2">
      <h2 class="flex min-w-0 items-center gap-2 text-lg font-semibold text-content-primary">
        <span class="shrink-0">{{ t('visual.process') }}</span>
        <InlineRename
          v-if="!process.isInit"
          :model-value="processName"
          :editing="renaming"
          :disabled="disabled"
          @update:editing="renaming = $event"
          @commit="emit('rename', $event)"
        />
        <span v-else class="text-lg font-semibold">Init</span>
      </h2>
      <Badge variant="process">{{ t('visual.nodeRole.process') }}</Badge>
      <Badge v-if="process.isInit" variant="neutral">{{ t('visual.init.badge') }}</Badge>
      <Badge v-if="process.fsfFormal === 'formal'" variant="formal">{{ t('visual.fsfFormal') }}</Badge>
      <Badge v-else-if="process.fsfFormal === 'semi-formal'" variant="semi-formal">{{ t('visual.fsfSemiFormal') }}</Badge>
    </header>

    <div
      v-if="disabled"
      class="rounded-md border border-semantic-warning/40 bg-semantic-warning/10 px-3 py-2 text-sm text-semantic-warning"
    >
      {{ disabledMessage() }}
    </div>

    <SectionCard>
      <label class="mb-3 flex items-center gap-2 text-sm text-content-primary">
        <input v-model="isInitDraft" type="checkbox" class="rounded border-border-subtle" :disabled="disabled" />
        <span>{{ t('visual.init.label') }}</span>
      </label>
      <SignatureEditor
        :signature="process.signature ?? '()'"
        :inputs="process.inputs"
        :outputs="process.outputs"
        kind="process"
        :disabled="disabled"
        @patch="emit('patchSignature', $event)"
      />
    </SectionCard>

    <ExtBlockEditor
      :vars="process.ext ?? []"
      :disabled="disabled"
      @patch="emit('patchExt', $event)"
    />

    <SectionCard>
      <FormField :label="t('visual.decom')">
        <TextField
          v-model="decomText"
          :disabled="disabled"
          :placeholder="t('visual.decomPlaceholder')"
        />
      </FormField>
      <FormField :label="t('visual.comment')" class="mt-4">
        <TextField
          v-model="commentText"
          :rows="3"
          :disabled="disabled"
          :placeholder="t('visual.commentPlaceholder')"
        />
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
    <p v-else class="text-sm text-content-secondary">{{ t('visual.noFsf') }}</p>
  </div>
</template>
