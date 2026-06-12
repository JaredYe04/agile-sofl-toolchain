<script setup lang="ts">
import { ref, computed, provide, watch } from 'vue'
import { useEditorUiStore } from '../../stores/editorUi'
import { useDocumentStore } from '../../stores/document'
import { useDocumentHistoryStore } from '../../stores/documentHistory'
import { useLspDiagnosticsStore } from '../../stores/lspDiagnostics'
import { useEditorSelectionStore } from '../../stores/editorSelection'
import { useDocumentDiagnosticsStore } from '../../stores/documentDiagnostics'
import { useVisualModel } from '../../composables/useVisualModel'
import { VISUAL_MODEL_KEY } from '../../composables/visualModelContext'
import {
  mergeDiagnostics,
  filterDiagnosticsBySelection,
  type MergedDiagnostic
} from '@agile-sofl/editor-api'
import type { DiagnosticSummary } from '../../preload/index'
import SplitPane from '../ui/SplitPane.vue'
import MonacoEditor from './MonacoEditor.vue'
import VisualEditor from './visual/VisualEditor.vue'
import VisualIssuesPanel from './visual/VisualIssuesPanel.vue'
import type { SerializableSpan } from './MonacoEditor.vue'

const monacoRef = ref<InstanceType<typeof MonacoEditor> | null>(null)
const visualRef = ref<InstanceType<typeof VisualEditor> | null>(null)
const editorUi = useEditorUiStore()
const doc = useDocumentStore()
const history = useDocumentHistoryStore()
const lspDiagnostics = useLspDiagnosticsStore()
const editorSelection = useEditorSelectionStore()
const documentDiagnostics = useDocumentDiagnosticsStore()

const visual = useVisualModel(computed(() => doc.activeTabId))
provide(VISUAL_MODEL_KEY, visual)

const showLeft = computed(() => editorUi.showMonaco())
const showRight = computed(() => editorUi.showVisual())
const isDocumentActive = computed(() => doc.activeTab?.kind === 'document')
const issuesOpen = ref(true)

const unifiedDiagnostics = computed((): MergedDiagnostic[] => {
  if (!isDocumentActive.value) return []
  const visualItems = (visual.diagnostics.value ?? []) as DiagnosticSummary[]
  return mergeDiagnostics(visualItems, lspDiagnostics.markers)
})

const filteredDiagnostics = computed(() => {
  const modules = visual.model.value?.modules ?? []
  if (!editorUi.showVisual()) {
    return unifiedDiagnostics.value
  }
  return filterDiagnosticsBySelection(
    unifiedDiagnostics.value,
    editorSelection.selection,
    modules
  )
})

watch(unifiedDiagnostics, (items) => {
  documentDiagnostics.setUnified(items)
  if (items.length > 0) issuesOpen.value = true
})

watch(isDocumentActive, (active) => {
  if (!active) {
    lspDiagnostics.clear()
    editorSelection.clear()
    documentDiagnostics.clear()
  }
})

function runEditCommand(cmd: string): void {
  monacoRef.value?.runEditCommand(cmd)
}

function applyHistory(cmd: 'undo' | 'redo'): boolean {
  const tab = doc.activeTab
  if (!tab || tab.kind !== 'document') return false
  const content = cmd === 'undo' ? history.undo(tab.id, tab.content) : history.redo(tab.id, tab.content)
  if (content === null) return false
  monacoRef.value?.applyContent(content, true)
  return true
}

function revealSpan(span: SerializableSpan): void {
  monacoRef.value?.revealSpan(span)
}

defineExpose({
  runEditCommand,
  formatDocument() {
    return monacoRef.value?.formatDocument() ?? Promise.resolve(false)
  },
  undo: () => applyHistory('undo'),
  redo: () => applyHistory('redo'),
  revealSpan
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <SplitPane class="min-h-0 flex-1" :show-left="showLeft" :show-right="showRight">
      <template #left>
        <MonacoEditor v-if="showLeft" ref="monacoRef" />
      </template>
      <template #right>
        <VisualEditor v-if="showRight" ref="visualRef" @reveal-span="revealSpan" />
      </template>
    </SplitPane>
    <VisualIssuesPanel
      v-if="isDocumentActive"
      v-model:open="issuesOpen"
      :diagnostics="filteredDiagnostics"
      @reveal-span="revealSpan"
    />
  </div>
</template>
