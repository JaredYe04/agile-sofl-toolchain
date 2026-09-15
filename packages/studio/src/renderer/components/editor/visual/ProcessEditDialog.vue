<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VisualModuleProcess } from '../../../preload/index'
import type { FsfModelDto } from './FsfScenarioEditor.vue'
import type { SymbolHint } from './predicate/predicateTypes'
import ProcessEditor, { type ProcessEditorDraft } from './ProcessEditor.vue'
import AliasProcessEditor from './AliasProcessEditor.vue'
import VisualEditDialog from './overview/VisualEditDialog.vue'

const props = defineProps<{
  open: boolean
  process: VisualModuleProcess | null
  processName: string
  moduleName: string
  fsfModel: FsfModelDto | null
  disabled?: boolean
  blockInformal?: boolean
  writeDisabledReason?: 'parseFailed' | 'diagnostics' | null
  symbols?: SymbolHint[]
}>()

const emit = defineEmits<{
  close: []
  apply: [draft: ProcessEditorDraft]
  patchAlias: [target: string]
}>()

const { t } = useI18n()
const editorRef = ref<InstanceType<typeof ProcessEditor> | null>(null)

function confirm(): void {
  if (!props.process) return
  if (props.process.isAlias) {
    emit('close')
    return
  }
  const draft = editorRef.value?.getDraft()
  if (draft) emit('apply', draft)
}
</script>

<template>
  <VisualEditDialog
    :open="open && Boolean(process)"
    size="lg"
    :title="t('visual.process.editTitle', { name: process?.isInit ? 'Init' : processName })"
    @close="emit('close')"
    @confirm="confirm"
  >
    <AliasProcessEditor
      v-if="process?.isAlias"
      :process="process"
      :disabled="disabled"
      :write-disabled-reason="writeDisabledReason"
      @patch-alias="emit('patchAlias', $event)"
    />
    <ProcessEditor
      v-else-if="process"
      ref="editorRef"
      draft-mode
      :process="process"
      :process-name="processName"
      :module-name="moduleName"
      :initial-decom="process.decom"
      :initial-comment="process.comment"
      :fsf-model="fsfModel"
      :symbols="symbols"
      :disabled="disabled"
      :write-disabled-reason="writeDisabledReason"
      :block-informal="blockInformal"
    />
  </VisualEditDialog>
</template>
