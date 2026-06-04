<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEditorUiStore } from '../../stores/editorUi'
import { useDocumentStore } from '../../stores/document'
import { useDocumentHistoryStore } from '../../stores/documentHistory'
import SplitPane from '../ui/SplitPane.vue'
import MonacoEditor from './MonacoEditor.vue'
import VisualEditor from './visual/VisualEditor.vue'
import type { SerializableSpan } from './MonacoEditor.vue'

const monacoRef = ref<InstanceType<typeof MonacoEditor> | null>(null)
const visualRef = ref<InstanceType<typeof VisualEditor> | null>(null)
const editorUi = useEditorUiStore()
const doc = useDocumentStore()
const history = useDocumentHistoryStore()

const showLeft = computed(() => editorUi.showMonaco())
const showRight = computed(() => editorUi.showVisual())

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

defineExpose({
  runEditCommand,
  formatDocument() {
    return monacoRef.value?.formatDocument() ?? Promise.resolve(false)
  },
  undo: () => applyHistory('undo'),
  redo: () => applyHistory('redo'),
  revealSpan(span: SerializableSpan) {
    monacoRef.value?.revealSpan(span)
  }
})
</script>

<template>
  <SplitPane :show-left="showLeft" :show-right="showRight">
    <template #left>
      <MonacoEditor v-if="showLeft" ref="monacoRef" />
    </template>
    <template #right>
      <VisualEditor v-if="showRight" ref="visualRef" @reveal-span="monacoRef?.revealSpan($event)" />
    </template>
  </SplitPane>
</template>
