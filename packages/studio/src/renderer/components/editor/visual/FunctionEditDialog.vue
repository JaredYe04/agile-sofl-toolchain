<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VisualFunctionItem } from '../../../preload/index'
import type { FsfModelDto } from './FsfScenarioEditor.vue'
import type { SymbolHint } from './predicate/predicateTypes'
import FunctionEditor from './FunctionEditor.vue'
import VisualEditDialog from './overview/VisualEditDialog.vue'

defineProps<{
  open: boolean
  fn: VisualFunctionItem | null
  moduleName: string
  fsfModel: FsfModelDto | null
  symbols?: SymbolHint[]
  disabled?: boolean
  blockInformal?: boolean
  writeDisabledReason?: 'parseFailed' | 'diagnostics' | null
}>()

const emit = defineEmits<{
  close: []
  patch: [payload: { body?: string; fsf?: { scenarios: FsfModelDto['scenarios']; others?: string } }]
  patchSignature: [signature: string]
  rename: [name: string]
  revealSpan: [span: VisualFunctionItem['span']]
}>()

const { t } = useI18n()
const editorRef = ref<InstanceType<typeof FunctionEditor> | null>(null)
</script>

<template>
  <VisualEditDialog
    :open="open && Boolean(fn)"
    size="lg"
    :title="t('visual.function.editTitle', { name: fn?.name ?? '' })"
    @close="emit('close')"
    @confirm="emit('close')"
  >
    <FunctionEditor
      v-if="fn"
      ref="editorRef"
      :fn="fn"
      :module-name="moduleName"
      :fsf-model="fsfModel"
      :symbols="symbols"
      :disabled="disabled"
      :write-disabled-reason="writeDisabledReason"
      :block-informal="blockInformal"
      @patch="emit('patch', $event)"
      @patch-signature="emit('patchSignature', $event)"
      @rename="emit('rename', $event)"
      @reveal-span="emit('revealSpan', $event)"
    />
  </VisualEditDialog>
</template>
