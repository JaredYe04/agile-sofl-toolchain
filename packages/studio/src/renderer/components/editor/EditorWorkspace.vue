<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEditorUiStore } from '../../stores/editorUi'
import SplitPane from '../ui/SplitPane.vue'
import MonacoEditor from './MonacoEditor.vue'
import VisualEditor from './visual/VisualEditor.vue'

const monacoRef = ref<InstanceType<typeof MonacoEditor> | null>(null)
const editorUi = useEditorUiStore()

const showLeft = computed(() => editorUi.showMonaco())
const showRight = computed(() => editorUi.showVisual())

defineExpose({
  runEditCommand(cmd: string) {
    monacoRef.value?.runEditCommand(cmd)
  }
})
</script>

<template>
  <SplitPane :show-left="showLeft" :show-right="showRight">
    <template #left>
      <MonacoEditor v-if="showLeft" ref="monacoRef" />
    </template>
    <template #right>
      <VisualEditor v-if="showRight" />
    </template>
  </SplitPane>
</template>
