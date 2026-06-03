<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, shallowRef } from 'vue'
import type * as Monaco from 'monaco-editor'
import { monaco, initMonacoBase } from '../../monaco/setup'
import { registerLanguageConfiguration, registerTextMateTokens } from '../../monaco/textmate'
import { startLanguageClient, uriForTab } from '../../monaco/languageClient'
import { useDocumentStore } from '../../stores/document'
import { useLspStore } from '../../stores/lsp'

const container = ref<HTMLElement | null>(null)
const editor = shallowRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
const models = new Map<string, Monaco.editor.ITextModel>()
let markerSub: Monaco.IDisposable | null = null

const doc = useDocumentStore()
const lsp = useLspStore()

defineExpose({
  runEditCommand(cmd: string) {
    const ed = editor.value
    if (!ed) return
    ed.focus()
    ed.trigger('menu', cmd, null)
  }
})

function getOrCreateModel(tabId: string, uri: string, content: string): Monaco.editor.ITextModel {
  let model = models.get(tabId)
  if (model) return model
  model = monaco.editor.createModel(content, 'agile-sofl', uriForTab(uri))
  models.set(tabId, model)
  return model
}

function syncModel(): void {
  const tab = doc.activeTab
  const ed = editor.value
  if (!tab || !ed) return
  const model = getOrCreateModel(tab.id, tab.uri, tab.content)
  if (ed.getModel()?.uri.toString() !== model.uri.toString()) {
    ed.setModel(model)
  }
}

function updateErrorCount(): void {
  const tab = doc.activeTab
  if (!tab) return
  const uri = uriForTab(tab.uri)
  const markers = monaco.editor.getModelMarkers({ resource: uri })
  lsp.setErrorCount(markers.filter((m) => m.severity === monaco.MarkerSeverity.Error).length)
}

function onContentChange(): void {
  const tab = doc.activeTab
  const ed = editor.value
  if (!tab || !ed) return
  const value = ed.getValue()
  if (value !== tab.content) doc.updateContent(tab.id, value)
}

onMounted(async () => {
  initMonacoBase()
  await registerTextMateTokens()
  await registerLanguageConfiguration()

  const isDark = document.documentElement.classList.contains('dark')
  if (container.value) {
    editor.value = monaco.editor.create(container.value, {
      theme: isDark ? 'agile-sofl-dark' : 'agile-sofl-light',
      automaticLayout: true,
      fontSize: 14,
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      tabSize: 4
    })
    editor.value.onDidChangeModelContent(onContentChange)
    syncModel()
  }

  await startLanguageClient()
  await lsp.refresh()

  markerSub = monaco.editor.onDidChangeMarkers(() => updateErrorCount())
})

watch(() => doc.activeTabId, () => {
  syncModel()
  updateErrorCount()
})

watch(
  () => doc.tabs.map((t) => `${t.id}:${t.content.length}:${t.uri}`).join('|'),
  () => {
    for (const tab of doc.tabs) {
      const model = models.get(tab.id)
      if (model && model.getValue() !== tab.content) {
        model.setValue(tab.content)
      }
    }
  }
)

onUnmounted(() => {
  markerSub?.dispose()
  editor.value?.dispose()
  for (const m of models.values()) m.dispose()
  models.clear()
})
</script>

<template>
  <div ref="container" class="h-full min-h-0 flex-1" />
</template>
