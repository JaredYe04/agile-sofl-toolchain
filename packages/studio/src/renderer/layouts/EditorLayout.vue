<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import TitleBar from '../components/chrome/TitleBar.vue'
import EditorTabs from '../components/editor/EditorTabs.vue'
import EditorToolbar from '../components/editor/EditorToolbar.vue'
import EditorWorkspace from '../components/editor/EditorWorkspace.vue'
import HomeView from '../components/home/HomeView.vue'
import WelcomeView from '../components/home/WelcomeView.vue'
import StatusBar from '../components/editor/StatusBar.vue'
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts'
import { useFileActions } from '../composables/useFileActions'
import NewFileDialog from '../components/home/NewFileDialog.vue'
import { useNewFileDialog } from '../composables/useNewFileDialog'
import { useDocumentStore } from '../stores/document'

const workspaceRef = ref<InstanceType<typeof EditorWorkspace> | null>(null)
const files = useFileActions()
const doc = useDocumentStore()
const newFileDialog = useNewFileDialog()

function onUndoRedo(cmd: 'undo' | 'redo'): boolean {
  return workspaceRef.value?.[cmd]() ?? false
}

const showDocumentEditor = computed(
  () => doc.activeTab?.kind === 'document' && !doc.showWelcomeFallback
)

function onEdit(cmd: string): void {
  workspaceRef.value?.runEditCommand(cmd)
}

function onFormat(): void {
  void workspaceRef.value?.formatDocument()
}

function onDevTools(): void {
  window.studio?.openDevTools()
}

useKeyboardShortcuts(
  (cmd) => onEdit(cmd),
  onDevTools,
  () => newFileDialog.show(),
  onFormat,
  onUndoRedo
)

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
    <TitleBar @edit="onEdit" @dev-tools="onDevTools" @format="onFormat" />
    <EditorTabs />
    <main class="flex min-h-0 flex-1 flex-col bg-surface-raised">
      <HomeView v-if="doc.isHomeActive" />
      <WelcomeView v-else-if="doc.showWelcomeFallback" />
      <template v-else-if="showDocumentEditor">
        <EditorToolbar @format="onFormat" />
        <EditorWorkspace ref="workspaceRef" class="min-h-0 flex-1" />
      </template>
    </main>
    <StatusBar />
    <NewFileDialog />
  </div>
</template>
