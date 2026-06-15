<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
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
import { useModalStore } from '../stores/modal'
import Modal from '../components/ui/Modal.vue'
import { useCommandCenterStore } from '../stores/commandCenter'

const workspaceRef = ref<InstanceType<typeof EditorWorkspace> | null>(null)
const files = useFileActions()
const doc = useDocumentStore()
const modalStore = useModalStore()
const newFileDialog = useNewFileDialog()
const commandCenter = useCommandCenterStore()

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

function registerCommandCenterHandlers(): void {
  const ws = workspaceRef.value
  commandCenter.registerHandlers({
    revealSpan: (span) => {
      ws?.revealSpan(span)
    },
    formatDocument: async () => {
      if (ws) return ws.formatDocument()
      const { formatActiveDocument } = await import('../composables/useFormatDocument')
      return formatActiveDocument(null)
    },
    undoRedo: (cmd) => (ws ? ws[cmd]() : false),
    runEdit: onEdit,
    openNewFile: () => newFileDialog.show(),
    openFile: () => files.openFile(),
    saveTab: () => files.saveTab(),
    saveAsTab: () => files.saveAsTab(),
    closeActiveTab: () => files.closeActiveTab(),
    openDevTools: onDevTools
  })
}

watch([workspaceRef, showDocumentEditor], () => registerCommandCenterHandlers(), { immediate: true })

useKeyboardShortcuts(
  (cmd) => onEdit(cmd),
  onDevTools,
  () => newFileDialog.show(),
  onFormat,
  onUndoRedo,
  {
    openCommandCenter: (q) => commandCenter.open(q),
    isCommandCenterOpen: () => commandCenter.isOpen,
    closeCommandCenter: () => commandCenter.close()
  }
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
    <Modal
      v-if="modalStore.request"
      :open="!!modalStore.request"
      :title="modalStore.request.title"
      :message="modalStore.request.message"
      :buttons="modalStore.request.buttons"
      :input="modalStore.request.input"
      :input-value="modalStore.request.inputValue"
      :input-placeholder="modalStore.request.inputPlaceholder"
      :checkbox="modalStore.request.checkbox"
      :checkbox-label="modalStore.request.checkboxLabel"
      :checkbox-value="modalStore.request.checkboxValue"
      @action="(i, v, c) => modalStore.respond(i, v, c)"
      @close="modalStore.dismiss"
    />
  </div>
</template>
