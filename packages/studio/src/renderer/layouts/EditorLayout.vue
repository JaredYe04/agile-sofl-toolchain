<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import TitleBar from '../components/chrome/TitleBar.vue'
import EditorTabs from '../components/editor/EditorTabs.vue'
import MonacoEditor from '../components/editor/MonacoEditor.vue'
import StatusBar from '../components/editor/StatusBar.vue'
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts'
import { useFileActions } from '../composables/useFileActions'

const monacoRef = ref<InstanceType<typeof MonacoEditor> | null>(null)
const files = useFileActions()

function onEdit(cmd: string): void {
  monacoRef.value?.runEditCommand(cmd)
}

useKeyboardShortcuts((cmd) => onEdit(cmd))

let unsubClose: (() => void) | undefined

onMounted(() => {
  unsubClose = window.studio?.onRequestClose(() => {
    files.tryCloseWindow()
  })
})

onUnmounted(() => {
  unsubClose?.()
})
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <TitleBar @edit="onEdit" />
    <EditorTabs />
    <main class="min-h-0 flex-1 bg-surface-raised">
      <MonacoEditor ref="monacoRef" />
    </main>
    <StatusBar />
  </div>
</template>
